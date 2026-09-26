AvNs.AddRunner("popup_vk", (ns, session, settings, locales) =>
{
    function PopupVk()
    {
        let m_callFunction = () => {};

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
            LocalizeElement("PopupVirtualKeyboardTitle", locales);
            SetClickHandler("OpenVkButton", OnOpenVkClick);

            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    activatePlugin("popup_vk", OnPing, OnError);
                });
            ns.ApplyStyle("vk", ["vk"]);
        }

        function OnOpenVkClick()
        {
            m_callFunction("popup_vk.showKeyboard");
        }

        Run();
    }

    let instance = null;
    ns.RunModule(() =>
    {
         if (!instance)
             instance = new PopupVk();
    });
});
