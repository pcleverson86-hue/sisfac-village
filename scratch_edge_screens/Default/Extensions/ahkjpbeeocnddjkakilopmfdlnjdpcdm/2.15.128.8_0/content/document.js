(function DocumentMain()
{
let tabId = 0;
const m_pluginId = "light_doc";

const docOptions = {
    name: m_pluginId,
    runner: () => {},
    getParameters: () => ({
            tabId: tabId,
            scriptPluginId: Math.floor((1 + Math.random()) * 0x10000).toString(16) 
        })
};
AvNs.AddRunner2(docOptions);

function GetStartupParameters()
{
    ApiCall(browsersApi.runtime.sendMessage)
        .OnSuccess(response =>
            {
                if (!response)
                {
                    setTimeout(GetStartupParameters, 100);
                }
                else
                {
                    tabId = response.tabId;
                    if (response.isConnectedToProduct)
                        AvNs.StartSession();
                    else
                        setTimeout(GetStartupParameters, 2 * 60 * 1000);
                }
            })
        .OnError(err =>
            {
                setTimeout(GetStartupParameters, 100);
                const logFunction = err.message === "The message port closed before a response was received." ? AvNs.SessionLog : AvNs.SessionError;
                logFunction(`Error on GetStartupParameters: ${err.message}`, m_pluginId);
            })
        .Start({ command: "getContentStartupParameters" });
}

function ProcessEstablishConnectionMessage(request, sender)
{
    try
    {
        if (browsersApi.runtime.lastError)
            throw browsersApi.runtime.lastError;

        if (sender.id !== browsersApi.runtime.id)
        {
            AvNs.SessionError({ message: "Security error. Unexpected sender.", details: `sender.id: ${sender.id}\r\ncurrent.id: ${browsersApi.runtime.id}` }, m_pluginId);
            return;
        }

        if (request.command === "connectionEstablished")
            setTimeout(GetStartupParameters, 100);
    }
    catch (e)
    {
        AvNs.SessionError(e, m_pluginId);
    }
}

GetStartupParameters();
browsersApi.runtime.onMessage.addListener(ProcessEstablishConnectionMessage);
})();
