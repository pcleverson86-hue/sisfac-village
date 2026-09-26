AvNs.AddRunner("ab_background", (ns, session, startSettings, locales) =>
{
    let m_callFunction = () => {};
    let m_isTaskEnabled = false;
    const m_pluginId = "ab_background";
    const m_buttonId = "AddToBlockList";

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    function GetContextMenuButtonSettings()
    {
        return {
            title: locales["AntiBannerContextMenuPrompt"],
            contexts: ["image"],
            targetUrlPatterns: ["http://*/*", "https://*/*"]
        };
    }

    function ProcessContextButtonCreateError(createError)
    {
        try
        {
            if (createError.message.startsWith("Cannot create item with duplicate id"))
            {
                ApiCall(browsersApi.contextMenus.update)
                    .OnError(updateError => ns.SessionError(updateError, m_pluginId))
                    .Start(m_buttonId, GetContextMenuButtonSettings());
            }
            else
            {
                ns.SessionError(createError, m_pluginId);
            }
        }
        catch (processError)
        {
            ns.SessionError(processError, m_pluginId);
        }
    }

    function AddContextMenu()
    {
        Cleanup();
        const createProperties = GetContextMenuButtonSettings();
        createProperties.id = m_buttonId;
        ApiCall(browsersApi.contextMenus.create, ApiCallType.WITH_CALLBACK)
            .OnError(ProcessContextButtonCreateError)
            .Start(createProperties);
        chrome.contextMenus.onClicked.addListener(HandleAddToBlockList);
    }

    function Cleanup()
    {
        ApiCall(browsersApi.contextMenus.removeAll, ApiCallType.WITH_CALLBACK)
            .OnError(err => ns.SessionError(err, m_pluginId))
            .Start();
    }

    function HandleAddToBlockList(args)
    {
        try
        {
            CheckLastError();
            m_callFunction("ab_background.AddToBlockList", { src: args.srcUrl });
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function SetTaskEnabled(isTaskEnabled)
    {
        if (isTaskEnabled === m_isTaskEnabled)
            return;
        m_isTaskEnabled = isTaskEnabled;
        if (m_isTaskEnabled)
            AddContextMenu();
        else
            Cleanup();
    }
    function OnSetTaskEnabled(settings)
    {
        SetTaskEnabled(settings.isTaskEnabled);
    }

    function Init()
    {
        session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
            {
                m_callFunction = callFunction;
                activatePlugin(m_pluginId, OnPing, Cleanup);
                registerMethod("ab_background.setTaskEnabled", OnSetTaskEnabled);
            });
        SetTaskEnabled(startSettings.isTaskEnabled);
    }

    Init();
});
