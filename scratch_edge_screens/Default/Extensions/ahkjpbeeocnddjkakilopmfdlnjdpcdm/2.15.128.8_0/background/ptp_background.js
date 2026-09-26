(function PtpBackground()
{
const m_pluginId = "ptp_back";
let instance = null;

function RunnerImpl(ns, session, settings, locales)
{
    const m_localSettings = new PtpSettings(ns);
    let m_settings = settings;
    let m_callFunction = () => {};

    function PtpPopupWindow()
    {
        let m_timeout = 0;

        if (m_localSettings.stopPropogate || !m_settings.enable)
            return;

        const m_window = new ns.PopupWindow("ptp_w"
                                            , session
                                            , "/ptp/popup_window.html"
                                            , "/ptp_back/popup_window.css"
                                            , { "ptp.openInfoLink": OpenInfoLink, "ptp.openUpgrade": OpenUpgrade });

        function OpenInfoLink()
        {
            ns.SessionLog(`${m_pluginId}: Open information link`);
        }
        function OpenUpgrade()
        {
            if (m_settings.stopOnUpgrade)
                m_localSettings.Update({ stopPropogate: true });

            ns.SessionLog(`${m_pluginId}: Open upgrade link`);
        }

        function CheckAndShow(res, args)
        {
            if (!res && args.count >= m_settings.minActionCount && !m_localSettings.stopPropogate)
            {
                locales["WindowPtpHeader"] = locales["WindowPtpHeaderTemplate"].replace("{}", args.count);
                m_localSettings.Update({ lastViewTime: Date.now(), nextViewPosition: m_localSettings.nextViewPosition + 1 });
                m_window.Open({ locales: locales });
            }
            WaitTime();
        }

        function GetCountActions()
        {
            ns.SessionLog("ptp: call get count actions");
            if (m_localSettings.stopPropogate)
            {
                ns.SessionLog("Skip get count actions");
                return;
            }
            ApiCall(browsersApi.tabs.query)
                .OnSuccess(result =>
                    {
                        if (result && result.length !== 0 && result[0].url)
                        {
                            ns.SessionLog(`Found active tab with id ${result[0].id} and url ${result[0].url}`);
                            m_callFunction(`${m_pluginId}.getCount`, { url: result[0].url }, CheckAndShow);
                        }
                        else
                        {
                            ns.SessionLog("Active tab not found, waiting");
                            WaitTime();
                        }
                    })
                .OnError(err => 
                    {
                        ns.SessionError(err, m_pluginId); 
                        WaitTime();
                    })
                .Start({ active: true, windowType: "normal" });
        }


        function WaitTime()
        {
            if (m_localSettings.nextViewPosition >= m_settings.waitDays.length || m_localSettings.stopPropogate)
            {
                ns.SessionLog(`ptp: skip wait time. Stop propogate: ${m_localSettings.stopPropogate}`);
                return;
            }

            const period = m_settings.waitDays[m_localSettings.nextViewPosition] * 24 * 60 * 60 * 1000;
            const now = Date.now();
            if (m_localSettings.lastViewTime + period > now)
            {
                const lastViewTime = (new Date(m_localSettings.lastViewTime)).toString();
                const nowTime = (new Date(now)).toString();
                const waitTime = Math.floor((m_localSettings.lastViewTime + period - now) / 1000);
                ns.SessionLog(`ptp: continue to wait. Last view: ${lastViewTime}, now: ${nowTime}, need to wait: ${waitTime}s`);
                m_timeout = setTimeout(WaitTime, m_localSettings.lastViewTime + period - now);
                return;
            }
            ns.SessionLog(`ptp: call get count actions after timeout ${m_settings.tryAgainTimeout}ms`);
            m_timeout = setTimeout(GetCountActions, m_settings.tryAgainTimeout);
        }

        function OnMessage(message, sender)
        {
            try
            {
                if (sender.url !== browsersApi.extension.getURL("popup/popup.html"))
                    return;
                if (message.command === "ptp.onUpdate")
                    OpenUpgrade();
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function Start()
        {
            m_localSettings.ReadSettingsFromStorage(WaitTime);
        }

        this.Close = () =>
        {
            ns.SessionLog("ptp: call stop, clear timeout");
            m_window.Close();
            ns.ClearTimeout(m_timeout);
            if (browsersApi.runtime.onMessage.hasListener(OnMessage))
                browsersApi.runtime.onMessage.removeListener(OnMessage);
        };

        browsersApi.runtime.onMessage.addListener(OnMessage);
        Start();
    }

    function PtpBackgroundImpl()
    {
        let m_ptpWindow = null;

        function ResetInstance()
        {
            if (m_ptpWindow)
                m_ptpWindow.Close();

            m_ptpWindow = new PtpPopupWindow();
        }

        function OnSetSettings(newSettings)
        {
            m_settings = newSettings;
            ResetInstance();
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function InitializePlugin()
        {
            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    AvNs.GetToolbarButton().SetMode(AvNs.ViewMode.FREE);
                    activatePlugin(m_pluginId, OnPing);
                    registerMethod(`${m_pluginId}.setSettings`, OnSetSettings);
                });
            ResetInstance();
        }

        this.Stop = () =>
        {
            if (m_ptpWindow)
                m_ptpWindow.Close();
        };

        InitializePlugin();
    }

    instance = new PtpBackgroundImpl();
}

function StopImpl()
{
    if (instance)
        instance.Stop();
}

AvNs.AddRunner2({
    name: m_pluginId,
    runner: RunnerImpl,
    stop: StopImpl
});

})();
