function PtpSettings(ns)
{
    const m_localSettings =
    {
        stopPropogate: false,
        lastViewTime: Date.now(),
        nextViewPosition: 0
    };

    function DefineProp(obj, name)
    {
        Object.defineProperty(obj, name, {
            get() { return m_localSettings[name]; }
        });
    }

    function UpdateLocal(obj)
    {
        for (const key in obj)
        {
            if (ns.ObjectHasOwnProperty.call(obj, key))
                m_localSettings[key] = obj[key];
        }
        ns.SessionLog(`ptp_settings after update local: ${JSON.stringify(m_localSettings)}`);
    }

    this.ReadSettingsFromStorage = callback =>
    {
        browsersApi.storage.local.get(["ptpSettings"], values =>
        {
            if (!values.ptpSettings)
                browsersApi.storage.local.set({ ptpSettings: m_localSettings });
            else
                UpdateLocal(values.ptpSettings);
            ns.SessionLog(`ptp_settings after read: ${JSON.stringify(m_localSettings)}`);

            if (callback)
                callback();
        });
    };

    this.Update = obj =>
    {
        UpdateLocal(obj);
        browsersApi.storage.local.set({ ptpSettings: m_localSettings });
    };

    this.ReadSettingsFromStorage();

    DefineProp(this, "stopPropogate");
    DefineProp(this, "lastViewTime");
    DefineProp(this, "nextViewPosition");
}
