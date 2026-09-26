var compromisedAccountHandler = AvNs.EmptyFunc;
var eventHandler = function eventHandler(arg) { compromisedAccountHandler(arg); };
AvNs.AddEventListener(document, "click", eventHandler, "ca");
AvNs.AddEventListener(document, "keydown", eventHandler, "ca");
AvNs.AddEventListener(document, "submit", eventHandler, "ca");
AvNs.AddRunner("ca", function AddRunnerCA(ns, session, settings)
{
    var m_callFunction = ns.EmptyFunc;
    var m_onUnloadCallFunction = ns.EmptyFunc;
    var m_bodySended = false;
    var m_lastSendedTime = 0;
    var m_domParser = ns.GetDomParser(session);
    var m_logins = [];
    var m_passwords = [];
    var m_forms = [];
    var m_buttons = [];
    var m_settings = settings;
    var m_submitCall = false;
    var m_pluginId = "ca";

    function CallService(commandName, argObject)
    {
        m_callFunction("ca." + commandName, argObject, null, null);
    }

    function TryOnUnloadCallService(commandName, argObject, resultCallback)
    {
        return m_onUnloadCallFunction("ca." + commandName, argObject, resultCallback);
    }
    function ProcessBeforeUnload()
    {
        try
        {
            if (!m_submitCall)
                return;

            var domWithWfd = m_domParser.SetWfdIds();
            if (!TryOnUnloadCallService("onHtml", { dom: domWithWfd }))
                CallService("onHtml", { dom: domWithWfd });
        }
        catch (e)
        {
            if (e.message === "out of memory")
            {
                ns.SessionLog("CA: Out of memory occured. Failed send dom before unload");
                return;
            }
            throw e;
        }
    }

    function OnSubmitWithAutofill(arg)
    {
        ns.SessionLog("=> OnSubmit with autofill eventType: " + arg.type);

        if (m_submitCall)
            return;

        m_submitCall = true;
        ns.AddEventListener(window, "beforeunload", ProcessBeforeUnload, m_pluginId);
    }

    function IsInList(element, elementList)
    {
        for (var i = 0; i < elementList.length; ++i)
        {
            if (element === elementList[i])
                return true;
        }
        return false;
    }

    function AddButtonsToList(submitButtons)
    {
        for (var i = 0; i < submitButtons.length; ++i)
        {
            var button = submitButtons[i];
            if (!IsInList(button, m_buttons))
                m_buttons.push(button);
        }
    }

    function GetElements(root, tag, type)
    {
        var selector = tag + "[type='" + type + "']";
        if (root === document)
        {
            if (ns.HasDocumentQuerySelectorAll())
                return ns.DocumentQuerySelectorAll(selector);
        }
        else if (ns.HasElementQuerySelectorAll())
        {
            return ns.ElementQuerySelectorAll(root, selector);
        }

        var result = [];
        var childrens = root.getElementsByTagName(tag);
        for (var i = 0; i < childrens.length; i++) 
        {
            if (ns.IsStringEqualIgnoreCase(childrens[i].type, type)) 
                result.push(childrens[i]);
        }
        return result;
    }

    function GetSingleButton()
    {
        var buttons = GetElements(document, "button", "submit"); 
        if (buttons && buttons.length > 0) 
            return buttons;
        buttons = document.getElementsByTagName("button");
        if (buttons && buttons.length === 1) 
            return buttons[0];
        var result = [];
        for (var i = 0; i < buttons.length; i++) 
        {
            if (ns.IsElementDisplayed(buttons[i])) 
                result.push(buttons[i]);
        }
        return result.length === 1 ? result[0] : [];
    }

    function OnGetPasswordSelectors(form)
    {
        return function Callback(result, selectors)
        {
            if (result !== 0 || selectors.length === 0)
            {
                ns.SessionLog("Couldn't get password selectors. Result: " + result + " selectors size: " + selectors.length);
                return;
            }

            for (var i = 0; i < selectors.length; ++i)
            {
                var passwordElement = document.querySelector(selectors[i]);
                if (!passwordElement)
                {
                    ns.SessionLog("Couldn't find element for password selector " + selectors[i]);
                    continue;
                }

                if (form.contains(passwordElement))
                {
                    ns.SessionLog("Form contains element for password selector " + selectors[i]);
                    m_passwords.push(passwordElement);
                }
            }
        };
    }

    function AddLoginInputToList(accountElement)
    {
        if (IsInList(accountElement, m_logins))
            return;

        ns.SessionLog("setting Enter Key event handlers for " + accountElement.id);

        m_logins.push(accountElement);
        if (accountElement.form)
        {
            var parentForm = accountElement.form;
            if (!IsInList(parentForm, m_forms))
            {
                ns.SessionLog("setting form submit event handlers for " + accountElement.id);
                m_forms.push(parentForm);

                m_domParser.GetPasswordSelectors(OnGetPasswordSelectors(parentForm));
            }

            ns.SessionLog("setting button click event handlers for " + accountElement.id);
            AddButtonsToList(GetElements(parentForm, "input", "submit"));
            AddButtonsToList(GetElements(parentForm, "button", "submit"));
            AddButtonsToList(GetElements(parentForm, "button", "button"));
        }
        else
        {
            ns.SessionLog("setting button click event handlers for " + accountElement.id);
            AddButtonsToList(GetSingleButton());
        }
    }

    function OnSubmit(arg)
    {
        var target = arg.target || arg.srcElement;
        if (!target)
        {
            ns.SessionLog("OnSubmit ignored cause empty target. eventType is " + arg.type);
            return;
        }

        ns.SessionLog("=> OnSubmit eventType: " + arg.type + " , target: " + target.id);
        if (arg.type === "keydown")
        {
            if (arg.keyCode !== 13)
                return;

            if (!IsInList(target, m_buttons) && !IsInList(target, m_logins) && !IsInList(target, m_passwords) && !IsInList(target, m_forms))
                return;
        }
        else if (arg.type === "click")
        {
            if (!IsInList(target, m_buttons) && !(target.parentElement && IsInList(target.parentElement, m_buttons)))
                return;
        }
        else if (arg.type === "submit")
        {
            if (!IsInList(target, m_forms))
                return;
        }

        var currentTime = ns.GetCurrentTime();
        if (currentTime - 500 < m_lastSendedTime)
        {
            ns.SessionLog("skipping OnSubmit due to timing");
            return; 
        }

        var accounts = [];
        for (var i = 0; i < m_logins.length; ++i)
        {
            var accountElement = m_logins[i];
            if (accountElement.value)
                accounts.push(ns.ToBase64(accountElement.value));
        }

        if (accounts.length > 0)
        {
            if (!TryOnUnloadCallService("onAccount", { accounts: accounts }))
                CallService("onAccount", { accounts: accounts });

            m_lastSendedTime = currentTime;
        }
        else
        {
            ns.SessionLog("CA: OnSubmit with no data occure");
        }

        ns.SessionLog("<= OnSubmit eventType: " + arg.type + " , target: " + target.id);
    }

    function OnGetLoginSelectors(result, onInputData)
    {
        m_submitCall = false;

        if (result !== 0 || onInputData.length === 0)
        {
            ns.SessionLog("Couldn't get login selectors. Result: " + result + " selectors size: " + onInputData.length);
            m_bodySended = false;
            return;
        }

        compromisedAccountHandler = OnSubmit;
        for (var i = 0; i < onInputData.length; ++i)
        {
            var accountElement = document.querySelector(onInputData[i]);
            if (!accountElement)
            {
                ns.SessionLog("Couldn't find element for login selector " + onInputData[i]);
                continue;
            }

            AddLoginInputToList(accountElement);
        }
    }

    function OnKeyDown(arg)
    {
        if (m_bodySended || arg.key === "F5")
            return;

        ns.SessionLog("Find login selectors.");
        m_bodySended = true;

        if (m_settings.submitHandlerEnabled)
            compromisedAccountHandler = OnSubmitWithAutofill;

        m_domParser.GetLoginSelectors(OnGetLoginSelectors);
    }

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    function OnInitializeCallback(activatePlugin, registerMethod, callFunction, deactivate, onUnloadCall)
    {
        m_callFunction = callFunction;
        m_onUnloadCallFunction = onUnloadCall;
        activatePlugin(m_pluginId, OnPing);
        ns.AddEventListener(document, "keydown", OnKeyDown, m_pluginId);
    }

    function InitializePlugin()
    {
        session.InitializePlugin(OnInitializeCallback);
        ns.SessionLog("Compromised account ready.");
    }

    InitializePlugin();
});
