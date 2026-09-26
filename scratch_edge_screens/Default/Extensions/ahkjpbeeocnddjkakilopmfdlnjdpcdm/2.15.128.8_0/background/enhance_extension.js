AvNs.AddRunner("ee", (ns, session, startSettings) =>
{
let m_callFunction = () => {};
const m_redirectIdList = {};
const m_redirectUrlList = {};

const DomainFilteringModeSkipAll = 0; 
const DomainFilteringModeProcessAll = 1;

let m_isDomainFilteringSupported = typeof startSettings.queueLimit !== "undefined";
let m_operationMode = startSettings.mode;
let m_queueLimit = startSettings.queueLimit;
let m_cacheLimit = startSettings.domainsCacheLimit;
let m_requestsCacheLimit = startSettings.requestsCacheLimit;

let m_isControledByProduct = typeof startSettings.isInterceptionEnabled !== "undefined";
let m_isInterceptionEnabled = m_isControledByProduct && startSettings.isInterceptionEnabled;
let m_isTabRedirectByBlockedResourceDisabled = typeof startSettings.isTabRedirectByBlockedResourceDisabled !== "undefined"
    && startSettings.isTabRedirectByBlockedResourceDisabled;

const m_domainsQueue = [];
let m_domains = new Set();
const m_pendingRequests = new Map();
const m_pendingRedirects = new Set();

let m_interceptMode = CalculateInterceptMode();
let m_noFilteringMode = CalculateNoFilteringMode();

const m_pluginId = "ee";

let m_blockingStarted = false;
let m_deferedBlockUrls = [];

function CalculateInterceptMode()
{
    return m_isInterceptionEnabled && (!m_isDomainFilteringSupported || (m_isDomainFilteringSupported && m_operationMode !== DomainFilteringModeSkipAll));
}

function CalculateNoFilteringMode()
{
    return !m_isDomainFilteringSupported || m_operationMode === DomainFilteringModeProcessAll;
}

function OnPing()
{
    return ns.MaxRequestDelay;
}

function OnError()
{
    browsersApi.declarativeNetRequest.getSessionRules()
        .then(rules =>
        {
            const ids = rules.map(rule => rule.id);
            browsersApi.declarativeNetRequest.updateSessionRules({removeRuleIds: ids});
        })
}

function AddOrUpdate(cache, key, redirectUrl, whiteUrl)
{
    const redirectInfo = { redirectUrl: redirectUrl };
    if (whiteUrl)
        redirectInfo.whiteUrl = whiteUrl;
    const oldInfo = cache[key];
    if (oldInfo && oldInfo.cleanupTimer)
        ns.ClearTimeout(oldInfo.cleanupTimer);

    cache[key] = redirectInfo;
    redirectInfo["cleanupTimer"] = ns.SetTimeout(() => { delete cache[key]; }, 1000 * 60 * 60, m_pluginId);
}

function GetRedirectInfo(requestId, requestUrl)
{
    let redirectInfo = m_redirectIdList[requestId];

    if (redirectInfo)
    {
        AddOrUpdate(m_redirectIdList, requestId, redirectInfo.redirectUrl);
    }
    else
    {
        redirectInfo = m_redirectUrlList[requestUrl];
        if (redirectInfo)
            AddOrUpdate(m_redirectUrlList, requestUrl, redirectInfo.redirectUrl, redirectInfo.whiteUrl);
        else
            return null;
    }

    return redirectInfo;
}


function FinishBlockForCurrentSession()
{
    m_deferedBlockUrls.splice(0, 1);
    ns.SessionLog(`Take from defered queue. Now size is ${m_deferedBlockUrls.length}`);

    if (m_deferedBlockUrls.length)
    {
        ProcessNextDeferedBlock();
    }
    else
    {
        m_blockingStarted = false;
    }
}

function ProcessNextDeferedBlock()
{
    const url = m_deferedBlockUrls[0].url;
    const onBlockedCallback = m_deferedBlockUrls[0].onSuccess;
    const onFailedCallback = m_deferedBlockUrls[0].onFail;
    m_blockingStarted = true;
    browsersApi.declarativeNetRequest.getSessionRules()
        .then(rules =>
        {
            if (rules.find(rule => rule.condition.urlFilter === url))
            {
                ns.SessionLog(`Rule for url: ${url} already exist`);
                return;
            }

            ns.SessionLog(`Before update session rules succeeded with url: ${url}`);
            return browsersApi.declarativeNetRequest.updateSessionRules({
                    addRules: [{
                        id: rules.length + 1,
                        action: { type: "block" },
                        condition: { urlFilter: `|${url}|` }
                    }]
                });
        })
        .then(() => {
                ns.SessionLog(`Update session rules succeeded with url: ${url}`);
                onBlockedCallback();
                FinishBlockForCurrentSession();
            })
        .catch(err => {
                ns.SessionError(err, m_pluginId);
                onFailedCallback();
                FinishBlockForCurrentSession();
            });
}

function BlockForCurrentSession(url, onBlockedCallback, onFailedCallback)
{
    if (m_deferedBlockUrls.find(deferedRule => deferedRule.url === url))
    {
        onFailedCallback();
    }
    else
    {
        m_deferedBlockUrls.push({url: url, onSuccess: onBlockedCallback, onFail: onFailedCallback});
        ns.SessionLog(`Extend defered queue. Now size is ${m_deferedBlockUrls.length}`);
    }

    if (!m_blockingStarted)
    {
        ProcessNextDeferedBlock();
    }
}

function ProcessRedirectObject(details)
{
    const redirectInfo = GetRedirectInfo(details.requestId, details.url);
    if (!redirectInfo)
        return;

    const redirectCallback = (isRedirected, err) =>
    {
        try
        {
            const redirected = !isRedirected ? false : !err;
            callToService("redirectHandled", { redirected: redirected, requestId: details.requestId });
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    };

    const redirectHandler = err => { redirectCallback(true, err); };
    const redirectFailedHandler = () => { redirectCallback(false); };

    if (details.type !== "main_frame")
    {
        if (m_isTabRedirectByBlockedResourceDisabled)
        {
            redirectFailedHandler();
        }
        else
        {
            const reloadParentTab = () =>
            {
                ApiCall(browsersApi.tabs.reload)
                    .OnSuccess(() => redirectHandler())
                    .OnError(err => redirectHandler(err))
                    .Start(details.tabId, { bypassCache: true });
            };
            BlockForCurrentSession(details.url, reloadParentTab, redirectFailedHandler);
        }
    }
    else
    {
        ApiCall(browsersApi.tabs.update)
            .OnSuccess(() => redirectHandler())
            .OnError(err => redirectHandler(err))
            .Start(details.tabId, { url: redirectInfo.redirectUrl });
    }
}

function onBeforeNavigate(details)
{
    const keys = Object.keys(m_redirectUrlList);
    for (const key of keys)
    {
        const item = m_redirectUrlList[key];
        if (!item.whiteUrl || item.whiteUrl !== details.url)
            continue;

        if (item.cleanupTimer)
            ns.ClearTimeout(item.cleanupTimer);

        delete m_redirectUrlList[key];
    }
}

function onBeforeSendHeaders(details)
{
    try
    {
        CheckLastError();

        const eventInfo =
        {
            requestId: details.requestId,
            url: details.url,
            method: details.method,
            resourceType: details.type,
            tabId: details.tabId,
            frameId: details.frameId,
            requestHeaders: details.requestHeaders || [],
            isRedirect: m_pendingRedirects.delete(details.requestId)
        };

        if (!eventInfo.requestHeaders.find(header => header.name === "referer") && details.initiator)
            eventInfo.requestHeaders.push({ name: "referer", value: details.initiator });

        ProcessEvent(details, "sendHeaders", eventInfo);
    }
    catch (e)
    {
        ns.SessionError(e, m_pluginId);
    }
}

function onHeadersReceived(details)
{
    try
    {
        CheckLastError();

        const eventInfo =
        {
            requestId: details.requestId,
            statusLine: details.statusLine,
            statusCode: details.statusCode,
            responseHeaders: details.responseHeaders
        };

        ProcessEvent(details, "headersReceived", eventInfo);
    }
    catch (e)
    {
        ns.SessionError(e, m_pluginId);
    }
}

function onBeforeRedirect(details)
{
    try
    {
        CheckLastError();
        m_pendingRedirects.add(details.requestId);
    }
    catch (e)
    {
        ns.SessionError(e, m_pluginId);
    }
}

function SendNotificationByIndex(list, index)
{
    while (list[index].notifications.length)
    {
        const notification = list[index].notifications.shift();
        callToService(notification.methodName, notification.methodParam);
    }
    list.splice(index, 1);
}

function ProcessRequestComplete(details)
{
    if (m_interceptMode || m_noFilteringMode)
        return true;

    const domain = new URL(details.url).hostname.toLowerCase();
    if (m_domains.has(domain))
        return true;

    const domainRequestsSlot = m_pendingRequests.get(domain);
    if (domainRequestsSlot)
    {
        const index = domainRequestsSlot.findIndex(element => element.requestId === details.requestId);
        if (index !== -1)
            domainRequestsSlot.splice(index, 1);
        if (domainRequestsSlot.length === 0)
            m_pendingRequests.delete(domain);
    }
    return false;
}

function AlwaysFalse()
{
    return false;
}

function IsProcessRedirectPossible(details)
{
    return (details.tabId && details.tabId > 0)
        || AlwaysFalse(ns.SessionLog(`Can not reload tab ${JSON.stringify(details)}`));
}

function onCompleted(details)
{
    try
    {
        CheckLastError();

        if (ProcessRequestComplete(details))
            callToService("requestComplete", { requestId: details.requestId });

        if (IsProcessRedirectPossible(details))
            ProcessRedirectObject(details);
    }
    catch (e)
    {
        ns.SessionError(e, m_pluginId);
    }
}

function onRequestError(details)
{
    try
    {
        CheckLastError();

        if (ProcessRequestComplete(details))
            callToService("requestError", { requestId: details.requestId, error: details.error });
    }
    catch (e)
    {
        ns.SessionError(e, m_pluginId);
    }
}

function callToService(commandPostfix, args)
{
    m_callFunction(`ee.${commandPostfix}`, args);
}

function ProcessEvent(details, method, methodData)
{
    if (m_interceptMode || m_noFilteringMode)
    {
        callToService(method, methodData);
        return;
    }

    const domain = new URL(details.url).hostname.toLowerCase();
    if (m_domains.has(domain))
    {
        callToService(method, methodData);
        return;
    }

    let domainRequestsSlot = m_pendingRequests.get(domain);
    if (!domainRequestsSlot)
    {
        domainRequestsSlot = [];
        m_pendingRequests.set(domain, domainRequestsSlot);
    }

    let index = domainRequestsSlot.findIndex(element => element.requestId === details.requestId);
    if (index === -1)
    {
        domainRequestsSlot.push({ requestId: details.requestId, notifications: [] });
        index = domainRequestsSlot.length - 1;
    }

    domainRequestsSlot[index].notifications.push({ methodName: method, methodParam: methodData });
    if (domainRequestsSlot[index].notifications.length > m_requestsCacheLimit)
        domainRequestsSlot[index].notifications.shift();
}

function OnRedirectCall(redirectDetails)
{
    if (redirectDetails.requestUrl)
        AddOrUpdate(m_redirectUrlList, redirectDetails.requestUrl, redirectDetails.url, redirectDetails.whiteUrl);
    else
        AddOrUpdate(m_redirectIdList, redirectDetails.requestId, redirectDetails.url);

    if (IsProcessRedirectPossible(redirectDetails))
    {
        ns.SetTimeout(() =>
        {
            const details = { requestId: redirectDetails.requestId, url: redirectDetails.requestUrl, type: redirectDetails.type, tabId: redirectDetails.tabId };
            ProcessRedirectObject(details);
        }, 500, m_pluginId);
    }
}

function SubscribeToRequestEvents()
{
    var filter = { urls: ["https://*/*"] };

    browsersApi.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, filter, []);
    browsersApi.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, filter);
    browsersApi.webRequest.onHeadersReceived.addListener(onHeadersReceived, filter);
    browsersApi.webRequest.onCompleted.addListener(onCompleted, filter, []);
    browsersApi.webRequest.onErrorOccurred.addListener(onRequestError, filter);
}

function OnSetSettings(settings)
{
    m_isDomainFilteringSupported = settings && typeof settings.queueLimit !== "undefined";
    m_operationMode = settings.mode;
    m_queueLimit = settings.queueLimit;
    m_cacheLimit = settings.domainsCacheLimit;
    m_requestsCacheLimit = settings.requestsCacheLimit;

    m_isControledByProduct = settings && typeof settings.isInterceptionEnabled !== "undefined";
    m_isInterceptionEnabled = m_isControledByProduct && settings.isInterceptionEnabled;
    m_isTabRedirectByBlockedResourceDisabled = settings && typeof settings.isTabRedirectByBlockedResourceDisabled !== "undefined"
        && settings.isTabRedirectByBlockedResourceDisabled;

    m_interceptMode = CalculateInterceptMode();
    m_noFilteringMode = CalculateNoFilteringMode();
}

function SendCachedNotifications(domain)
{
    const domainRequestsSlot = m_pendingRequests.get(domain);
    if (!domainRequestsSlot)
        return;

    while (domainRequestsSlot.length)
        SendNotificationByIndex(domainRequestsSlot, 0);

    m_pendingRequests.delete(domain);
}

function OnDomainFilteringRequested(connectionInfo)
{
    const domain = connectionInfo.domain.toLowerCase();
    if (m_domainsQueue.length >= m_queueLimit)
        m_domainsQueue.shift();
    m_domainsQueue.push(domain);
    if (m_domains.size < m_cacheLimit)
        m_domains.add(domain);
    else
        m_domains = new Set(m_domainsQueue);
    SendCachedNotifications(domain);
}

function onPluginInitialized(activatePlugin, registerMethod, callFunction)
{
    m_callFunction = callFunction;

    activatePlugin(m_pluginId, OnPing, OnError);
    registerMethod("ee.redirect", OnRedirectCall);
    registerMethod("ee.setSettings", OnSetSettings);
    registerMethod("ee.onDomainFilteringRequested", OnDomainFilteringRequested);

    ns.SessionLog(`Subscribe with modes: intercept = ${m_interceptMode}, noFilter = ${m_noFilteringMode}.`);
    SubscribeToRequestEvents();
    browsersApi.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
}

function InitializePlugin()
{
    if (m_isControledByProduct)
        session.InitializePlugin(onPluginInitialized);
}

InitializePlugin();
});
