AvNs.AddRunner("cns", function AddRunnerCNS(ns, session, settings)
{
    var m_callFunction = ns.EmptyFunc;
    var m_domParser = ns.GetDomParser(session);
    var m_settings = settings;
    var m_pluginId = "cns";

    function CallService(commandName, argObject)
    {
        m_callFunction("cns." + commandName, argObject, null, null);
    }

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    function OnElementClickedTimeout(selector)
    {
        if (!document.querySelector(selector))
            CallService("onElementClicked");
        else
            ns.SessionError("Cookies was not accepted for url " + window.location.href + " selector " + selectorObject.selector, m_pluginId);
    }

    function GetCookieSelectorCallback(result, selectorObject)
    {
        ns.SessionLog("Get cookie selector callback called with result " + result + " selector " + selectorObject.selector);
        if (result === 0 && selectorObject && selectorObject.selector)
        {
            CallService("onSelectorFound");

            var button = document.querySelector(selectorObject.selector);
            if (button)
            {
                if (!selectorObject.isSuitedSelector)
                    ns.SessionError("Result was sFalse, but button was found for url " + window.location.href + " selector " + selectorObject.selector, m_pluginId);

                CallService("onElementFound");
                button.click();

                ns.SetTimeout(function TimerCallback() { OnElementClickedTimeout(selectorObject.selector); }, 100, m_pluginId);
            }
            else if (selectorObject.isSuitedSelector)
            {
                ns.SessionError("Button was not found for url " + window.location.href + " selector " + selectorObject.selector, m_pluginId);
            }
        }
    }

    function OnLoadTimerCallback()
    {
        ns.SessionLog("On load timer callback called");
        m_domParser.GetCookieSelector(GetCookieSelectorCallback);
    }

    function OnLoad()
    {
        ns.SetTimeout(OnLoadTimerCallback, 1000);
    }

    function OnSetSettings(settings)
    {
        m_settings = settings;
    }

    function OnInitializeCallback(activatePlugin, registerMethod, callFunction, deactivate, onUnloadCall)
    {
        m_callFunction = callFunction;
        activatePlugin(m_pluginId, OnPing);
        registerMethod("cns.setSettings", OnSetSettings);
        ns.AddEventListener(window, "load", OnLoad, m_pluginId);
    }

    function InitializePlugin()
    {
        session.InitializePlugin(OnInitializeCallback);
    }

    InitializePlugin();
});
