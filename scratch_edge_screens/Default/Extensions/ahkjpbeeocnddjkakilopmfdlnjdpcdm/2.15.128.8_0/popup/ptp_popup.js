AvNs.AddRunner("ptp_popup", (ns, session, settings, locales) =>
{
    function PaidTierPromoPopup()
    {
        function InitializePlugin()
        {
            LocalizeElement("PopupPtpTitle", locales);
            LocalizeElement("PopupPtpDntTitle", locales);
            LocalizeElement("PopupPtpDntDescription", locales);
            LocalizeElement("PopupPtpAntibannerTitle", locales);
            LocalizeElement("PopupPtpAntibannerDescription", locales);
            LocalizeElement("PopupPtpSafeMoneyTitle", locales);
            LocalizeElement("PopupPtpSafeMoneyDescription", locales);
            LocalizeElement("PopupPtpUnlockDescription", locales);
            LocalizeElement("PopupPtpUpgradeButtonText", locales);

            SetClickHandler("PopupPtpUpgradeButton", OnUpgradeButtonClick);

            session.InitializePlugin(activatePlugin =>
                {
                    activatePlugin("ptp_popup", OnPing, OnError);
                });
            ns.ApplyStyle("ptp", ["ptp"]);
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function OnError()
        {
            ns.ApplyStyle("ptp", []);
        }

        function OnUpgradeButtonClick()
        {
            ns.SessionLog("ptp_popup: Open upgrade link");

            ApiCall(browsersApi.runtime.sendMessage)
                .OnError(err => ns.SessionLog(`ptp.OnUpgradeButtonClick failed with error ${err.message}`))
                .Start({ command: "ptp.onUpdate" });

            if (locales["PopupPtpUpgradeButtonLink"])
                window.open(locales["PopupPtpUpgradeButtonLink"]);
        }

        InitializePlugin();
    }

    let instance = null;
    ns.RunModule(() =>
    {
        if (!instance)
            instance = new PaidTierPromoPopup();
    });
});
