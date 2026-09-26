(function AntiBannerBackground()
{

let m_callFunction = () => {};

let m_popupRules = null;
let m_deactivateFunction = () => {};
const FromSameSiteRequestType = 0;
const FromAnotherSiteRequestType = 1;
let m_popupUrl = "";
let m_excludedDomains = null;
const m_pluginId = "abn_back";

function RunnerImpl(ns, session, startSettings)
{
    function OnPing()
    {
        return ns.MaxRequestDelay;
    }
    function OnSetSettings(settings)
    {
        m_excludedDomains = settings.excludedDomains ? settings.excludedDomains : null;
        SetPopupRules(settings);
    }
    function SetPopupRules(settings)
    {
        const needSubscribe = !m_popupRules;

        if (!settings.popupRules)
            m_popupRules = null;
        else
            m_popupRules = settings.popupRules;
        if (needSubscribe && m_popupRules)
            SubscribePopups();
        if (!m_popupRules && !needSubscribe)
            UnsubscribePopups();
    }
    function CheckSite(parentUrl, targetUrl, targetTabId)
    {
        const siteFromBlackList = MatchPopupRules(m_popupRules.blackRules, parentUrl, targetUrl);
        if (!siteFromBlackList)
            return;

        const siteFromWhiteList = MatchPopupRules(m_popupRules.whiteRules, parentUrl, targetUrl);
        if (!siteFromWhiteList)
        {
            m_callFunction("abn_back.popupEvent", { url: targetUrl.href, isBlocked: true });
            ApiCall(browsersApi.tabs.remove)
                .OnError(err => ns.SessionLog({ message: "popup ab: remove tab", details: `Error: ${err.message}` }, m_pluginId))
                .OnSuccess(() => ns.SessionLog(`Tab with url ${targetUrl.href} successfully removed`))
                .Start(targetTabId);
        }
        else
        {
            m_callFunction("abn_back.popupEvent", { url: targetUrl.href, isBlocked: false });
        }
    }
    function MatchPopupRules(rules, parentUrl, targetUrl)
    {
        if (!rules)
            return false;

        for (const rule of rules)
        {
            if (MatchPopupRule(parentUrl, targetUrl, rule))
                return true;
        }

        return false;
    }
    function MatchPopupRule(parentUrl, targetUrl, rule)
    {
        const matchTargetUrl = targetUrl.href.match(rule.urlRegex);
        if (!matchTargetUrl || matchTargetUrl.length === 0 || matchTargetUrl[0].length === 0)
            return false;

        const parentDomain = parentUrl.host;
        const targetDomain = targetUrl.host;

        if (rule.requestType === FromSameSiteRequestType && parentDomain !== targetDomain)
            return false;
        else if (rule.requestType === FromAnotherSiteRequestType && parentDomain === targetDomain)
            return false;

        if (!rule.includedRefererDomains || rule.includedRefererDomains.length === 0)
            return true;

        for (const includedRefererDomain of rule.includedRefererDomains)
        {
            let match = parentDomain.match("^(.+\\.)?" + includedRefererDomain + "$");
            if (match && match.length > 0)
            {
                if (!rule.excludedRefererDomains || rule.excludedRefererDomains.length === 0)
                    return true;

                for (const excludedRefererDomain of rule.excludedRefererDomains)
                {
                    match = parentDomain.match("^(.+\\.)?" + excludedRefererDomain + "$");
                    if (match && match.length > 0)
                        return false;
                }
                return true;
            }
        }

        return false;
    }

    function ProcessError(details, message)
    {
        if (message.startsWith("No tab with id") || message.startsWith("Invalid tab ID"))
            ns.SessionLog(`popup ab - Error on navigation event, details: ${ns.JSONStringify(details)}. Error: ${message}`);
        else
            ns.SessionError({ message: "ERR popup ab", details: `Error: ${message}` }, m_pluginId);
    }

    function IsExcludedDomain(url)
    {
        return m_excludedDomains !== null && m_excludedDomains.includes(url.hostname);
    }

    function OnCreatedNavigationTarget(details)
    {
        try
        {
            CheckLastError();

            if (details.sourceTabId < 0)
            {
                ns.SessionLog("Tab id less than 0, skip ab popup processing");
                return;
            }

            ApiCall(browsersApi.tabs.get)
                .OnSuccess(tab =>
                    {
                        try
                        {
                            const url = ns.TryCreateUrl(details.url);
                            if (!url)
                                return;
                            if (m_popupUrl && details.url === m_popupUrl)
                            {
                                ns.SessionLog(`popup ab - Skip site by url: ${m_popupUrl}`);
                            }
                            else if (IsExcludedDomain(url))
                            {
                                ns.SessionLog(`popup ab - Skip site by exclude domain: ${details.url}`);
                            }
                            else
                            {
                                const tabUrl = ns.TryCreateUrl(tab.url);
                                if (tabUrl)
                                    CheckSite(tabUrl, url, details.tabId);
                            }
                        }
                        catch (e)
                        {
                            ns.SessionError(e, m_pluginId);
                        }
                    })
                .OnError(err => ProcessError(details, err.message))
                .Start(details.sourceTabId);
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function OnMessage(request, sender)
    {
        try
        {
            CheckLastError();

            if (sender.id !== browsersApi.runtime.id)
            {
                ns.SessionError({ message: "Security error. Unexpected sender.", details: `sender.id: ${sender.id}\r\ncurrent.id: ${browsersApi.runtime.id}` }, m_pluginId);
                return;
            }

            if (request.command === "sendPopupUrl")
                m_popupUrl = request.url || "";
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }
    function SubscribePopups()
    {
        if (!browsersApi.webNavigation.onCreatedNavigationTarget)
            return; 

        if (!browsersApi.webNavigation.onCreatedNavigationTarget.hasListener(OnCreatedNavigationTarget))
            browsersApi.webNavigation.onCreatedNavigationTarget.addListener(OnCreatedNavigationTarget);

        browsersApi.runtime.onMessage.addListener(OnMessage);
    }
    function UnsubscribePopups()
    {
        if (!browsersApi.webNavigation.onCreatedNavigationTarget)
            return; 

        if (browsersApi.webNavigation.onCreatedNavigationTarget.hasListener(OnCreatedNavigationTarget))
            browsersApi.webNavigation.onCreatedNavigationTarget.removeListener(OnCreatedNavigationTarget);
    }
    function Init()
    {
        session.InitializePlugin((activatePlugin, registerMethod, callFunction, deactivateFunction) =>
            {
                m_callFunction = callFunction;
                activatePlugin(m_pluginId, OnPing);
                registerMethod("abn_back.setSettings", OnSetSettings);
                m_deactivateFunction = deactivateFunction;
            });
        OnSetSettings(startSettings);
    }

    Init();
}

function StopImpl()
{
    m_deactivateFunction(m_pluginId);
}

AvNs.AddRunner2({
    name: m_pluginId,
    runner: RunnerImpl,
    stop: StopImpl
});
})();
