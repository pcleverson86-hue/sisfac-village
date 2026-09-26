AvNs.AddRunner("rm_bg", (ns, session, settings) =>
{    
    const m_pluginId = "rm_bg";
    const RequestActionCompleted = 0;
    const RequestActionError = 1;
    let m_settings = settings;
    let m_callFunction = () => {};

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    function onEventOccured(type, mask, detail)
    {
        ns.SessionLog(`rm: on event occured with type ${type} and mask ${mask}`);
        ApiCall(browsersApi.tabs.get)
                .OnError(err => ns.SessionLog({ message: "rm_bg: get tab", details: `Error: ${err.message}` }))
                .OnSuccess(tab => 
                    {
                        m_callFunction("rm_bg.onRequestAction", { type: type, 
                            urlMask: mask, 
                        url: detail.url, 
                        pageUrl: tab.url, 
                        method: detail.method, 
                        errorMessage: detail.error });
                    })
                .Start(detail.tabId);
    }

    function ClearHandlers()
    {
        if (!m_settings.settings)
            return;

        ns.SessionLog("rm: clear handlers");
        m_settings.settings.forEach((el, i, arr) =>
        {
            el.funcError && browsersApi.webRequest.onErrorOccurred.removeListener(el.funcError) && delete el.funcError;
            el.funcCompleted && browsersApi.webRequest.onCompleted.removeListener(el.funcCompleted) && delete el.funcCompleted;
            arr[i] = el;
        });
    }

    function SetHandlers()
    {
        if (!m_settings.settings)
        {
            ns.SessionLog("rm: skip set handlers");
            return;
        }

        ns.SessionLog("rm: set handlers");
        m_settings.settings.forEach((el, i, arr) =>
        {
            el.funcError = detail => { onEventOccured(RequestActionError, el.urlMask, detail); };
            el.funcCompleted = detail => { onEventOccured(RequestActionCompleted, el.urlMask, detail); };
            browsersApi.webRequest.onErrorOccurred.addListener(el.funcError, { urls: [el.urlMask] });
            browsersApi.webRequest.onCompleted.addListener(el.funcCompleted, { urls: [el.urlMask] });
            arr[i] = el;
        });
    }

    function OnChangeSettings(newSettings)
    {
        ClearHandlers();
        m_settings = newSettings;
        SetHandlers();
    }

    function Init()
    {
        session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
            {
                m_callFunction = callFunction;
                activatePlugin(m_pluginId, OnPing);
                registerMethod(m_pluginId + ".setSettings", OnChangeSettings);
            });
        SetHandlers();
    }

    Init();
});

