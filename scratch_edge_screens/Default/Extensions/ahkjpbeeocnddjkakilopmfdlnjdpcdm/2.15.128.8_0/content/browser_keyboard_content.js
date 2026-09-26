AvNs.AddRunner("vk_mac", (ns, session, settings, locales) =>
{
    function BrowserKeyboard()
    {
        const Selectors = [{ tagName: "input", types: ["password", "search", "tel", "text", "url"] }, { tagName: "textarea" }];

        const m_balloon = new ns.BrowserKeyboardBalloon(session, locales, OnBalloonDataReceived);
        const m_inputProcessor = new ns.BrowserKeyboardInputProcessor();
        const m_subscribedElements = [];

        let m_activeElement = null;
        let m_cachedActiveElement = null;
        let m_shutdown = false;
        let m_inputProcessed = false;
        let m_callFunction = ns.EmptyFunc;

        function IsElementSubscribed(element)
        {
            for (let i = 0; i < m_subscribedElements.length; ++i)
            {
                if (m_subscribedElements[i] === element)
                    return true;
            }
            return false;
        }

        function OnInput(data)
        {
            if (!m_activeElement)
            {
                if (m_cachedActiveElement)
                    m_activeElement = m_cachedActiveElement;
                else
                    return;
            }
            m_inputProcessor.OnInputAt(m_activeElement, data);
        }

        function OnShow()
        {
            if (m_activeElement)
                m_balloon.OnFocus(m_activeElement);
            else
                m_balloon.Show();
        }

        function OnHide()
        {
            if (m_inputProcessed)
                return;

                if (IsElementSubscribed(document.activeElement))
                    return;

                m_activeElement = null;
                m_cachedActiveElement = null;

                m_callFunction("popup_vk_mac.update_focus", { isFocused: false });
                m_balloon.Hide();
        }

        function CallInput(data)
        {
            m_callFunction("popup_vk_mac.input", data);
        }

        function CallShow()
        {
            if (m_inputProcessed)
            {
                m_inputProcessed = false;
                return;
            }
            m_callFunction("popup_vk_mac.show", { url: ns.StartLocationHref, fromPopup: false });
        }

        function CallHide()
        {
            m_callFunction("popup_vk_mac.hide");
        }

        function OnBalloonDataReceived(data)
        {
            m_inputProcessed = true;
            if (data.key === "dragStart")
                return;

            const key = m_inputProcessor.ToInputKey(data.key);
            const inputData = { key: key, text: ns.IsDefined(data.text) ? data.text : "" };
            const element = m_activeElement || m_cachedActiveElement;
            if (element)
                m_inputProcessor.OnInputAt(element, inputData);
            else
                CallInput(inputData);
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function SubscribeOnFocusPasswordField()
        {
            if (!document.body)
            {
                ns.AddEventListener(window, "load", SubscribeOnFocusPasswordField);
                return;
            }

            const inputs = document.getElementsByTagName("input");

            for (const input of inputs)
            {
                if (ns.IsStringEqualIgnoreCase(input.type, "password") && !IsElementSubscribed(input))
                {
                    input.addEventListener("focus", CallShow);
                    input.addEventListener("blur", CallHide);
                    m_subscribedElements.push(input);

                    if (input === document.activeElement)
                    {
                        m_activeElement = input;
                        CallShow();
                    }
                }
            }
        }

        function SubscribeWhenMutation()
        {
            if (window.MutationObserver)
            {
                const observer = new MutationObserver(SubscribeOnFocusPasswordField);
                observer.observe(document.getRootNode(), { attributes: true, childList: true, subtree: true });
            }
        }

        function OnSessionShutdown()
        {
            m_shutdown = true;
            m_observer.unbind();
        }

        function Init()
        {
            session.InitializePlugin((activatePlugin, registerMethod, callFunction) => 
                {
                    m_callFunction = callFunction;
                    activatePlugin("vk_mac", OnPing, null, OnSessionShutdown);
                    registerMethod("vk_mac.show", OnShow);
                    registerMethod("vk_mac.hide", OnHide);
                    registerMethod("vk_mac.input", OnInput);
                });

            browsersApi.runtime.onMessage.addListener(OnMessage);
            SubscribeOnFocusPasswordField();
            SubscribeWhenMutation();
        }

        function OnMessage(request, sender, sendResponse)
        {
            try
            {
                if (browsersApi.runtime.lastError)
                    ns.SessionLog(`Failed onMessage of vk mac ${browsersApi.runtime.lastError.message}`);

                if (request.command === "vk_mac.getHref" && ns.IsTopLevel)
                    ns.TrySendResponse(sendResponse, { url: ns.StartLocationHref });
            }
            catch (e)
            {
                ns.SessionError(e, "vk_mac");
            }
        }

        function OnElementFocus(element)
        {
            if (m_shutdown)
                return;

            m_activeElement = element;
            m_callFunction("popup_vk_mac.update_focus", { isFocused: true });
            ns.ProtectableElementDetector.ChangeTypeIfNeeded(element);
        }

        function OnElementBlur(element)
        {
            if (m_shutdown)
                return;

            ns.ProtectableElementDetector.RestoreTypeIfNeeded(element);
            m_cachedActiveElement = m_activeElement;
            m_activeElement = null;
        }

        const m_observer = new ns.FocusChangeObserver(OnElementFocus, OnElementBlur, () => {}, Selectors);

        Init();
    }

    let instance = null;
    ns.RunModule(() =>
    {
        if (!instance)
            instance = new BrowserKeyboard();
    }, 2000);
});
