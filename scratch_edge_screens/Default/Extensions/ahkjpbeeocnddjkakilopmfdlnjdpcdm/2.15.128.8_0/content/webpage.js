AvNs.AddRunner("wp", (ns, session) =>
{
function Webpage()
{
    let m_callFunction = ns.EmptyFunc;
    let m_processed = false;
    const m_pluginId = "wp";

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    function isFrameRedirected(callback)
    {
        ApiCall(browsersApi.runtime.sendMessage)
            .OnSuccess(response => callback(response.isRedirected))
            .OnError(err => ns.SessionLog(`Failed isFrameRedirected with error ${err.message}`))
            .Start({ command: "isFrameRedirected" });
    }

    function Process()
    {
        if (!m_processed)
        {
            if (document.documentElement)
            {
                m_callFunction("wp.content", { dom: document.documentElement.innerHTML });
                m_processed = true;
            }
            else
            {
                ns.SessionError({ message: "Failed process dom content. documentElement is null", details: { readyState: document.readyState } }, m_pluginId);
            }
        }
    }

    function DelayProcess()
    {
        if (document.readyState === "complete")
        {
            if (document.documentElement)
                Process();
            else
                ns.SetTimeout(Process, 1000, m_pluginId);
        }
        else
        {
            ns.AddEventListener(window, "load", () => { ns.SetTimeout(Process, 1000, m_pluginId); }, m_pluginId);
        }
    }

    session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
        {
            m_callFunction = callFunction;
            activatePlugin(m_pluginId, OnPing);
            registerMethod("wp.getFrameContent", Process);
        });

    if (!ns.IsTopLevel)
    {
        if (document.location.protocol === "blob:")
        {
            m_callFunction("wp.createProcessors", null, DelayProcess);
            return;
        }
        isFrameRedirected(isRedirected =>
        {
            if (isRedirected)
                m_callFunction("wp.createProcessors", null, DelayProcess);
        });
    }
    else
    {
        DelayProcess();
    }
}

let instance = null;
ns.RunModule(() =>
{
    if (!instance)
        instance = new Webpage();
});
});
