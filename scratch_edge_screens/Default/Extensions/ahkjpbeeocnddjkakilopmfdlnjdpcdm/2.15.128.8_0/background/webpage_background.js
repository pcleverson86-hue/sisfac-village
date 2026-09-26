(function WebPageBackground()
{

const m_navigatedFrames = {};
const m_pluginId = "webpage_back";

function onCommitted(details)
{
    try
    {
        CheckLastError();
        if (details.frameId !== 0 && (details.transitionQualifiers.includes("client_redirect") || details.transitionQualifiers.includes("server_redirect")))
        {
            if (!m_navigatedFrames || (details.tabId in m_navigatedFrames === false))
                m_navigatedFrames[details.tabId] = [];
            m_navigatedFrames[details.tabId].push(details.frameId);
        }
    }
    catch (e)
    {
       AvNs.SessionError(e, m_pluginId);
    }
}

function OnMessage(request, sender, sendResponse)
{
    try
    {
        CheckLastError();
        if (sender.id !== browsersApi.runtime.id)
        {
            AvNs.SessionError({ message: "Security error. Unexpected sender.", details: `sender.id: ${sender.id}\r\ncurrent.id: ${browsersApi.runtime.id}` }, m_pluginId);
            return;
        }

        if (request.command === "isFrameRedirected")
        {
            const frames = sender.tab && m_navigatedFrames[sender.tab.id];
            if (frames)
            {
                const redirected = typeof frames.find(element => element === sender.frameId) !== "undefined";
                AvNs.TrySendResponse(sendResponse, { isRedirected: redirected });
            }
        }
    }
    catch (e)
    {
        AvNs.SessionError(e, m_pluginId);
    }
}

function ClearNavigatedFrames(tabId)
{
    try
    {
        CheckLastError();
        if (tabId in m_navigatedFrames)
            delete m_navigatedFrames[tabId];
    }
    catch (e)
    {
        AvNs.SessionError(e, m_pluginId);
    }
}

function Init()
{
    browsersApi.tabs.onRemoved.addListener(ClearNavigatedFrames);
    browsersApi.tabs.onReplaced.addListener((newTabId, oldTabId) => { ClearNavigatedFrames(oldTabId); });

    if (!browsersApi.webNavigation.onCommitted.hasListener(onCommitted))
        browsersApi.webNavigation.onCommitted.addListener(onCommitted);

    browsersApi.runtime.onMessage.addListener(OnMessage);
}

Init();

})();
