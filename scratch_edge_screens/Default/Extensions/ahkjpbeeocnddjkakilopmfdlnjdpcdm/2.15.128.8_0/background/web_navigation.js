(function WebNavigation()
{

let m_callFunction = AvNs.EmptyFunc;
let m_deactivateFunction = AvNs.EmptyFunc;
const m_pluginId = "wn";

function onRemoved(removedTabId)
{
    try
    {
        CheckLastError();
        m_callFunction("wn.onRemoved",
            {
                tabId: removedTabId
            });
    }
    catch (e)
    {
        AvNs.SessionError(e, m_pluginId);
    }
}

function onBeforeRedirect(details)
{
    try
    {
        CheckLastError();
        m_callFunction("wn.onBeforeRedirect",
            {
                url: details.redirectUrl,
                parentUrl: details.url,
                tabId: details.tabId
            });
    }
    catch (e)
    {
        AvNs.SessionError(e, m_pluginId);
    }
}

function onBeforeNavigate(details)
{
    try
    {
        CheckLastError();
        m_callFunction("wn.onBeforeNavigate",
            {
                tabId: details.tabId,
                url: details.url,
                isFrame: details.frameId !== 0
            });
    }
    catch (e)
    {
        AvNs.SessionError(e, m_pluginId);
    }
}

function onCommitted(details)
{
    try
    {
        AvNs.SessionLog(`onCommitted. url: ${details.url}, qualifiers: ${details.transitionQualifiers}`);

        CheckLastError();

        const transitionQualifiers = details.transitionQualifiers.reverse();
        if (transitionQualifiers.length === 0)
        {
            if (details.transitionType === "reload")
                transitionQualifiers.push("from_address_bar");
            else
                transitionQualifiers.push("unknown");
        }

        for (const item of transitionQualifiers)
        {
            let transitionQualifierEnum = 0;
            if (item === "client_redirect")
                transitionQualifierEnum = 1;
            else if (item === "server_redirect")
                transitionQualifierEnum = 2;
            else if (item === "forward_back")
                transitionQualifierEnum = 3;
            else if (item === "from_address_bar")
                transitionQualifierEnum = 4;
            else
                transitionQualifierEnum = 0;

            m_callFunction("wn.onCommitted", {
                    url: details.url,
                    redirectType: transitionQualifierEnum,
                    tabId: details.tabId,
                    isFrame: details.frameId !== 0
                });
        }
    }
    catch (e)
    {
        AvNs.SessionError(e, m_pluginId);
    }
}

function Subscribe()
{
    browsersApi.webNavigation.onCommitted.addListener(onCommitted);
    browsersApi.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);

    const filter = { urls: ["https://*/*", "http://*/*"] };
    browsersApi.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, filter, []);

    browsersApi.tabs.onRemoved.addListener(onRemoved);
}

function Unsubscribe()
{
    if (browsersApi.webNavigation.onCommitted.hasListener(onCommitted))
        browsersApi.webNavigation.onCommitted.removeListener(onCommitted);
    if (browsersApi.webNavigation.onBeforeNavigate.hasListener(onBeforeNavigate))
        browsersApi.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
    if (browsersApi.webRequest.onBeforeRedirect.hasListener(onBeforeRedirect))
        browsersApi.webRequest.onBeforeRedirect.removeListener(onBeforeRedirect);
    if (browsersApi.tabs.onRemoved.hasListener(onRemoved))
        browsersApi.tabs.onRemoved.removeListener(onRemoved);
}

function RunnerImpl(ns, session)
{
function onPing()
{
    return ns.MaxRequestDelay;
}

function onPluginInitialized(activatePlugin, registerMethod, callFunction, deactivateFunction)
{
    m_callFunction = callFunction;
    activatePlugin(m_pluginId, onPing);
    m_deactivateFunction = deactivateFunction;

    Subscribe();
}

session.InitializePlugin(onPluginInitialized);
}

function StopImpl()
{
    Unsubscribe();
    m_deactivateFunction(m_pluginId);
}

AvNs.AddRunner2({
    name: m_pluginId,
    runner: RunnerImpl,
    stop: StopImpl
});
})();
