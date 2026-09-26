AvNs.CheckPasswordStrength = PasswordStrengthChecker.getPasswordStrength;
AvNs.NeedToShowBalloon = NeedToShowBalloon;

AvNs.AddRunner("pc", function AddRunnerPc(ns, session, settings, locales)
{
    var PasswordControl = function PasswordControl()
    {
        var m_callFunction = ns.EmptyFunc;
        var m_balloon = null;


        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        session.InitializePlugin(function InitializePluginPc(activatePlugin, registerMethod, callFunction)
            {
                m_callFunction = callFunction;
                activatePlugin("pc", OnPing);
                registerMethod("pc.disable", function PcDisable()
                    {
                        if (m_balloon)
                            m_balloon.Disable();
                    });
                registerMethod("pc.showBalloon", function PcShowBalloon(obj)
                    {
                        if (m_balloon && ns.IsTopLevel)
                            m_balloon.ShowBalloon(obj);
                    });
                registerMethod("pc.hideBalloon", function PcHideBalloon()
                    {
                        if (m_balloon && ns.IsTopLevel)
                            m_balloon.HideBalloon();
                    });
            });

        m_balloon =  new ns.PasswordControlBalloon(settings, locales, m_callFunction, session);
    };


    var instance = null;
    ns.RunModule(function RunModulePasswordControl()
    {
        if (!instance)
            instance = new PasswordControl();
    });
});
