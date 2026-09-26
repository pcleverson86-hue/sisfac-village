AvNs.AddRunner("wsc", function AddRunnerWsc(ns, session)
{
    var WebsiteCredentials = function WebsiteCredentials()
    {
        var m_callFunction = ns.EmptyFunc;
        var m_syncCallFunction = ns.EmptyFunc;
        var m_lastPasswordSended = null;
        var m_subscribedAttributeName = "kl_wsc_" + ns.GetCurrentTime();
        var m_pluginId = "wsc";
        var m_passwordInputObserver = ns.GetDomChangeObserver("input", m_pluginId);

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }
        function IsSubscribedElement(element)
        {
            return element[m_subscribedAttributeName];
        }
        function MarkSubscribedElement(element)
        {
            element[m_subscribedAttributeName] = true;
        }
        function GetElements(element, tag, type)
        {
            var selector = tag + "[type='" + type + "']";
            if (element === document)
            {
                if (ns.HasDocumentQuerySelectorAll())
                    return ns.DocumentQuerySelectorAll(selector);
            }
            else if (ns.HasElementQuerySelectorAll())
            {
                return ns.ElementQuerySelectorAll(element, selector);
            }

            var result = [];
            var childrens = element.getElementsByTagName(tag);
            for (var i = 0; i < childrens.length; i++)
            {
                if (ns.IsStringEqualIgnoreCase(childrens[i].type, type))
                    result.push(childrens[i]);
            }
            return result;
        }

        function GetFormAction(parentForm)
        {
            var formAction = parentForm.action;
            if (typeof parentForm.action !== "string" && parentForm.getAttribute)
            {
                var tmp = ns.DocumentCreateElement("form");
                ns.ElementSetAttribute.call(tmp, "action", parentForm.getAttribute("action"));
                formAction = tmp.action;
            }
            if (formAction && (formAction.toLowerCase().indexOf("http://") === 0 || formAction.toLowerCase().indexOf("https://") === 0))
                return formAction;
            return "";
        }

        function OnSubmitEventListener(element, parentForm)
        {
            var isElementVisible = ns.IsElementDisplayed(element);
            if (isElementVisible && Boolean(element.value) && element.value !== m_lastPasswordSended)
            {
                m_lastPasswordSended = element.value;
                var hash = ns.md5(element.value) || "";
                var url = GetFormAction(parentForm) || document.location.toString() || "";
                var args = { url: url, passwordHash: hash };
                if (!m_syncCallFunction("wsc.WebsiteCredentialSendPasswordHash", args))
                    m_callFunction("wsc.WebsiteCredentialSendPasswordHash", args);
            }
            else
            {
                ns.SessionLog("Submit click, but password not send. Is element visible: " + isElementVisible +
                    ". Has element value: " + Boolean(element.value));
            }
        }

        function GetCallback(element, parentForm)
        {
            return function callback()
            {
                OnSubmitEventListener(element, parentForm);
            };
        }

        function GetSubmitButtons(parentForm)
        {
            return GetElements(parentForm, "input", "submit");
        }
        function GetSingleButton(parentForm)
        {
            var buttons = GetElements(parentForm, "button", "submit"); 
            if (buttons.length > 0) 
                return buttons;

            buttons = parentForm.getElementsByTagName("button");
            var result = [];
            for (var i = 0; i < buttons.length; i++)
            {
                if (ns.IsElementDisplayed(buttons[i])) 
                    result.push(buttons[i]);
            }
            return result;
        }
        function SetEnterKeyEventListener(element, callback)
        {
            ns.AddEventListener(element, "keydown", function OnKeydown(e) { if (e.keyCode === 13) callback(); }, m_pluginId);
        }
        function SetButtonClickEventListener(element, callback)
        {
            ns.AddEventListener(element, "click", callback, m_pluginId);
        }
        function SetFormEventListeners(parentForm, elements, callback)
        {
            for (var i = 0; i < elements.length; ++i) 
            {
                SetButtonClickEventListener(elements[i], callback);
                SetEnterKeyEventListener(elements[i], callback);
            }
            SetEnterKeyEventListener(parentForm, callback);
            ns.AddEventListener(parentForm, "submit", callback, m_pluginId);
        }
        function SetEventListeners()
        {
            var passwordEditors = GetElements(document, "input", "password");
            ns.SessionLog("Founded password inputs count " + passwordEditors.length);
            for (var i = 0, length = passwordEditors.length; i < length; ++i)
            {
                if (IsSubscribedElement(passwordEditors[i]))
                    continue;
                var passwordForm = passwordEditors[i].form || document;
                if (passwordForm)
                {
                    var buttons = GetSubmitButtons(passwordForm);
                    if (buttons.length === 0)
                        buttons = GetSingleButton(passwordForm);
                    ns.SessionLog("Buttons count " + buttons.length);
                    var callback = GetCallback(passwordEditors[i], passwordForm);

                    SetFormEventListeners(passwordForm, buttons, callback);
                    SetEnterKeyEventListener(passwordEditors[i], callback);
                }
                MarkSubscribedElement(passwordEditors[i]);
            }
        }

        function OnSessionShutdown()
        {
            ns.SessionLog("Stop observe input for WSC");
            if (m_passwordInputObserver)
                m_passwordInputObserver.Stop();
        }

        function Initialize()
        {
            session.InitializePlugin(function InitializePluginWsc(activatePlugin, registerMethod, callFunction, deactivate, syncCall)
            {
                m_callFunction = callFunction;
                m_syncCallFunction = syncCall;
                activatePlugin(m_pluginId, OnPing, null, OnSessionShutdown);
            });

            SetEventListeners();
            m_passwordInputObserver.Start(SetEventListeners);
            ns.AddEventListener(window, "load", SetEventListeners, m_pluginId);
            ns.SessionLog("WSC finish initialize");
        }

        Initialize();
    };

    var instance = null;
    ns.RunModule(function RunModuleWebsiteCredentials()
    {
        if (!instance)
            instance = new WebsiteCredentials();
    }, 2000);
});
