(function PopupWindowMain(ns) 
{
    ns.PopupWindow = function PopupWindow(pluginName, session, windowSrc, windowCssPostfix, callbacks)
    {
        let m_id = null;
        const m_initData = { pluginName: pluginName };

        function IsOperaBrowser()
        {
            const operaVersion = /OPR\/(\d*)./;
            return operaVersion.test(navigator.userAgent);
        }

        function GetResourceUrl()
        {
            if (IsOperaBrowser())
            {
                const guidRegExp = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
                return browsersApi.extension.getURL(`snapshot_resources${windowSrc}`).replace(guidRegExp, chrome.runtime.id);
            }
            return browsersApi.extension.getURL(`snapshot_resources${windowSrc}`);
        }

        function CreateWindow(screen)
        {
            const popupUrl = GetResourceUrl();
            ApiCall(browsersApi.windows.create)
                .OnSuccess(windowInfo =>
                    {
                        ns.SessionLog(`Popup window for plugin ${pluginName} created. Target url is ${popupUrl}`);
                        if (windowInfo && windowInfo.id)
                        {
                            m_id = windowInfo.id;
                            ns.SessionLog(`Window id: ${m_id}`);
                        }
                    })
                .OnError(err => ns.SessionError(err))
                .Start({
                    url: popupUrl,
                    type: "popup",
                    focused: true,
                    height: 1,
                    width: 1,
                    left: screen ? screen.width : 100000,
                    top: screen ? screen.height : 100000
                });
        }

        function OnCssLoad(data)
        {
            m_initData.cssData = data;
        }

        function OnCssLoadError(errorMessage)
        {
            const currentErrorMessage = `Failed load css resource for plugin ${pluginName}. Error message: ${errorMessage}`;
            if (errorMessage && errorMessage.startsWith("NMS call timeout for"))
            {
                ns.SessionLog(currentErrorMessage);
                return;
            }
            ns.SessionError({ message: currentErrorMessage, details: `windowCssPostfix: ${windowCssPostfix}` });
        }

        function OnInitReceived()
        {
            ApiCall(browsersApi.runtime.sendMessage)
                .OnError(err => ns.SessionLog(`init window for plugin ${pluginName} failed with error ${err.message}`))
                .Start({
                    receiver: GetResourceUrl(),
                    command: "init",
                    initData: m_initData
                });
        }

        function OnMessage(message, sender)
        {
            try
            {
                if (browsersApi.runtime.lastError)
                    ns.SessionLog(`init window for plugin ${pluginName} failed with error ${browsersApi.runtime.lastError.message}`);

                const resourceUrl = new URL(GetResourceUrl());
                const senderUrl = new URL(sender.url);
                if (senderUrl.pathname === resourceUrl.pathname)
                {
                    if (message.command === "init")
                    {
                        OnInitReceived();
                        return;
                    }
                    if (message.command === "log")
                    {
                        ns.SessionLog(`Popup log for ${pluginName}: ${message.log}`);
                        return;
                    }
                    for (const name in callbacks)
                    {
                        if (ns.ObjectHasOwnProperty.call(callbacks, name))
                        {
                            if (name === message.command)
                                callbacks[name]();
                        }
                    }
                }
            }
            catch (e)
            {
                ns.SessionError(e);
            }
        }

        function Init()
        {
            if (windowCssPostfix)
                session.GetResource(windowCssPostfix, OnCssLoad, OnCssLoadError);

            browsersApi.runtime.onMessage.addListener(OnMessage);
            browsersApi.windows.onRemoved.addListener(windowId =>
                {
                    try
                    {
                        CheckLastError();
                        if (windowId === m_id)
                            m_id = null;
                    }
                    catch (e)
                    {
                        ns.SessionError(e, "ufb");
                    }
                });
        }

        this.Open = request =>
        {
            ns.SessionLog(`Call popup open for plugin ${pluginName}`);
            for (const key in request)
            {
                if (ns.ObjectHasOwnProperty.call(request, key))
                    m_initData[key] = request[key];
            }

            CreateWindow(request.screen);
        };

        this.Close = () =>
        {
            if (m_id !== null)
            {
                ApiCall(browsersApi.windows.getAll)
                    .OnSuccess(windowInfoArray =>
                        {
                            if (windowInfoArray.some(windowInfo => windowInfo.id === m_id))
                            {
                                ApiCall(browsersApi.windows.remove)
                                    .OnError(err => ns.SessionError(err))
                                    .Start(m_id);
                            }
                        })
                    .OnError(err => ns.SessionError(err))
                    .Start({ windowTypes: ["popup"] });
            }
        };

        this.IsOpened = () => m_id !== null;

        Init();
    };
})(AvNs || {});
