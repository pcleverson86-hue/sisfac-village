AvNs.AddRunner("wsm", function AddRunnerWsm(ns, session)
{
    if (!ns.IsTopLevel)
        return;

    var m_callFunction = null;

    var m_activatedState = 0;
    var m_activatedStateChangeTimeout = null;
    var m_documentTitleIsAvailable = false;
    var m_stateChangeDelayTimeout = null;
    var m_processActivate = null;
    var m_pluginId = "wsm";

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    function GetTitle()
    {
        if (typeof document.title !== "string")
            return "";
        return document.title;
    }

    function ForceRedirect(args)
    {
        ns.SessionLog("Force reload to address: " + args.url);
        document.location.href = args.url;
    }

    function FireDeactivateEventImpl()
    {
        if (m_callFunction)
        {
            m_callFunction("wsm.sessionDeactivated", { title: GetTitle() }, function SessionDeactivatedCallback()
            {
                if (m_activatedState === 1)
                    m_processActivate();
                m_activatedState = 0;
            });
        }

        m_activatedState = 3;
    }

    function FireDeactivateEvent()
    {
        if (m_documentTitleIsAvailable)
            FireDeactivateEventImpl();
        else
            ns.ClearTimeout(m_stateChangeDelayTimeout);
    }

    function ProcessDeactivate()
    {
        ns.ClearTimeout(m_activatedStateChangeTimeout);
        m_activatedStateChangeTimeout = ns.SetTimeout(function TimerCallback()
            {
                if (m_activatedState === 2)
                    FireDeactivateEvent();
                else if (m_activatedState === 1)
                    m_activatedState = 3;
            }, 0, m_pluginId);
    }

    function FireActivateEventImpl()
    {
        if (m_callFunction)
        {
            m_callFunction("wsm.sessionActivated", { title: GetTitle() }, function SessionActivatedCallback()
            {
                if (m_activatedState === 3)
                    ProcessDeactivate();
                m_activatedState = 2;
            });
        }
        m_activatedState = 1;
    }

    function FireActivateEvent()
    {
        ns.ClearTimeout(m_stateChangeDelayTimeout);

        if (m_documentTitleIsAvailable || GetTitle())
        {
            m_documentTitleIsAvailable = true;
            FireActivateEventImpl();
        }
        else
        {
            m_stateChangeDelayTimeout = ns.SetTimeout(function TimerCallback()
                {
                    m_documentTitleIsAvailable = true;
                    m_processActivate();
                }, 500, m_pluginId);
        }
    }

    function ProcessActivate()
    {
        ns.ClearTimeout(m_activatedStateChangeTimeout);
        m_activatedStateChangeTimeout = ns.SetTimeout(function TimerCallback()
            {
                if (m_activatedState === 0)
                    FireActivateEvent();
                else if (m_activatedState === 3)
                    m_activatedState = 1;
            }, 0, m_pluginId);
    }

    function IsFocusedDocument()
    {
        return document.hasFocus && document.hasFocus();
    }

    function OnFocus()
    {
        if (m_callFunction)
            ProcessActivate();
    }

    function OnBlur()
    {
        if (m_callFunction && !IsFocusedDocument())
            ProcessDeactivate();
    }

    function OnHashChange()
    {
        var args = { newLocationUrl: document.location.href };
        if (m_callFunction)
            m_callFunction("wsm.onHashChange", args);
    }


    function OnSessionShutdown()
    {
        ns.ClearTimeout(m_activatedStateChangeTimeout);
        m_activatedStateChangeTimeout = null;
        m_callFunction = null;
    }

    function Initialize()
    {
        m_processActivate = ProcessActivate;
        session.InitializePlugin(function InitializePluginWsm(activatePlugin, registerMethod, callFunction)
        {
            m_callFunction = callFunction;
            activatePlugin(m_pluginId, OnPing, null, OnSessionShutdown);
            registerMethod("wsm.forceRedirect", ForceRedirect);
        });

        if (IsFocusedDocument())
        {
            FireActivateEvent();
            ns.AddEventListener(window, "load", function OnLoad()
                {
                    if (!IsFocusedDocument())
                        ProcessDeactivate();
                }, m_pluginId);
        }

        if (window.addEventListener)
        {
            ns.AddEventListener(window, "focus", OnFocus, m_pluginId);
            ns.AddEventListener(window, "blur", OnBlur, m_pluginId);
        }
        else
        {
            ns.AddEventListener(document, "focusin", OnFocus, m_pluginId);
            ns.AddEventListener(document, "focusout", OnBlur, m_pluginId);
        }

        if ("onhashchange" in window)
            ns.AddEventListener(window, "hashchange", OnHashChange, m_pluginId);
    }

    Initialize();
}, {
    referrer: document.referrer,
    stubId: (function stubId()
    {
        var scripts = [];
        scripts = AvNs.DocumentQuerySelectorAll("[stubid]");

        if (scripts && scripts.length > 0)
            return scripts[0].getAttribute("stubid");
        return "";
    })()
});
