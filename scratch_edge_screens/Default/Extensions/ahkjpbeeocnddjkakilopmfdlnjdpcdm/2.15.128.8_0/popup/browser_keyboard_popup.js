AvNs.AddRunner("popup_vk_mac", (ns, session) =>
{
    function PopupVkMac()
    {
        let m_callFunction = ns.EmptyFunc;

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function OnError()
        {
            ns.ApplyStyle("vk", []);
        }

        function Run()
        {
            SetClickHandler("PopupVkMacOpenButton", OnOpenVkClick);

            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    activatePlugin("popup_vk_mac", OnPing, OnError);
                });
        }

        function OnOpenVkClick()
        {
            ApiCall(browsersApi.tabs.query)
                .OnSuccess(tabs =>
                    {
                        if (tabs.length > 0)
                        {
                            ApiCall(browsersApi.tabs.sendMessage)
                                .OnSuccess(response => m_callFunction("popup_vk_mac.show", { url: response.url, fromPopup: true }))
                                .OnError(err => ns.SessionError(err, "popup_vk_mac"))
                                .Start(tabs[0].id, { command: "vk_mac.getHref" });
                        }
                    })
                .OnError(err => ns.SessionError(err, "popup_vk_mac"))
                .Start(AvNs.QueryActiveTabFromPopupArgs);
        }

        Run();
    }

    let instance = null;
    ns.RunModule(() =>
    {
         if (!instance)
             instance = new PopupVkMac();
    });
});
