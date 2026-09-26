AvNs.AddRunner("vs", function AddRunnerVs(ns, session)
{
    var VisitedSites = function VisitedSites()
    {
        var m_callFunction = ns.EmptyFunc;
        var m_domParser = ns.GetDomParser(session);
        var m_subscribedElements = [];

        var m_flags = {
            onPasswordEntered: false,
            onAddressEntered: false,
            onCardEntered: false
        };

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }
        function IsElementSubscribed(element)
        {
            for (var i = 0; i < m_subscribedElements.length; ++i)
            {
                if (m_subscribedElements[i] === element)
                    return true;
            }
            return false;
        }

        function MakeCallFunctionCallback(flag, onKeyDown)
        {
            return function callback()
            {
                m_flags[flag] = true;

                if (m_flags.onPasswordEntered && m_flags.onAddressEntered && m_flags.onCardEntered)
                {
                    ns.RemoveEventListener(document, "keydown", onKeyDown);
                    ns.RemoveEventListener(document, "change", onKeyDown);
                }

                m_callFunction("vs." + flag);
            };
        }

        function MakeCallback(flag, target, onKeyDown)
        {
            if (m_flags[flag] || !target)
                return ns.EmptyFunc;

            var flagCallFunction = MakeCallFunctionCallback(flag, onKeyDown);

            return function Callback(result, selectors)
            {
                if (result || m_flags[flag])
                    return;

                for (var i = 0; i < selectors.length; i++)
                {
                    if (m_flags[flag])
                        return;

                    var element = document.querySelector(selectors[i]);
                    if (window.MutationObserver && element && !ns.IsStringEqualIgnoreCase(ns.TryGetTagName(element), "input") && !IsElementSubscribed(element))
                    {
                        var mutationObserver = new MutationObserver(flagCallFunction);
                        mutationObserver.observe(element, { childList: true, characterData: true, subtree: true });
                        m_subscribedElements.push(element);
                    }

                    if (element && element === target)
                        flagCallFunction();
                }
            };
        }

        function OnKeyDown(evt)
        {
            try 
            {
                if (!AvNs.IsValidTargetProperty(evt) || !ns.IsStringEqualIgnoreCase(ns.TryGetTagName(evt.target), "input"))
                    return;

                m_domParser.GetPasswordSelectors(MakeCallback("onPasswordEntered", evt.target, OnKeyDown));
                m_domParser.GetNewPasswordSelectors(MakeCallback("onPasswordEntered", evt.target, OnKeyDown));
                m_domParser.GetAddressSelectors(MakeCallback("onAddressEntered", evt.target, OnKeyDown));
                m_domParser.GetCardSelectors(MakeCallback("onCardEntered", evt.target, OnKeyDown));
            }
            catch (e)
            {
                ns.SessionError(e, "vs");
            }
        }

        function Initialize()
        {
            session.InitializePlugin(function InitializePluginVs(activatePlugin, registerMethod, callFunction)
                {
                    m_callFunction = callFunction;
                    activatePlugin("vs", OnPing);
                    ns.AddRemovableEventListener(document, "keydown", OnKeyDown);
                    ns.AddRemovableEventListener(document, "change", OnKeyDown);
                });
        }

        Initialize();
    };


    var instance = null;
    ns.RunModule(function RunModuleVisitedSites()
    {
        if (!instance)
            instance = new VisitedSites();
    });
});
