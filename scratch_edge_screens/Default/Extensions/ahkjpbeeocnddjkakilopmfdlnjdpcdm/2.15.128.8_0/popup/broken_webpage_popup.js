AvNs.AddRunner("bwfb_popup", (ns, session, settings, locales) =>
{
    function BrokenWebpageFeedbackPopup()
    {
        let m_settings = null;

        function InitializePlugin()
        {
            LocalizeElement("PopupBwfbTitle", locales);

            SetSettings(settings);
            if (ns.IsDefined(settings.enabled) && !settings.enabled)
            {
                ns.DisableElementById("OpenBwfbWindowButton");
            }
            else
            {
                SetClickHandler("OpenBwfbWindowButton", OnOpenBwfbWindowClick);
                session.InitializePlugin((activatePlugin, registerMethod) =>
                    {
                        activatePlugin("bwfb_popup", OnPing, OnError);
                        registerMethod("bwfb_popup.updateSettings", SetSettings);
                    });
            }
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function OnError()
        {
            ns.ApplyStyle("bwfb", []);
        }

        function OnOpenBwfbWindowClick()
        {
            ApiCall(browsersApi.runtime.sendMessage)
                .OnError(err => ns.Log(`bwfb.openWindow failed with error ${err.message}`))
                .Start({
                    command: "bwfb.openWindow",
                    settings: m_settings,
                    locales: locales,
                    screen: { width: screen.width, height: screen.height }
                });
        }

        function SetSettings(bwpSettings)
        {   
            m_settings = bwpSettings;
            ns.ApplyStyle("bwfb", ["bwfb"]);
        }

        InitializePlugin();
    }

    let instance = null;
    ns.RunModule(() =>
    {
        if (!instance)
            instance = new BrokenWebpageFeedbackPopup();
    });
});
