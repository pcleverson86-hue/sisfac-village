AvNs.AddRunner("afp_popup", (ns, session, settings, locales) =>
{
    function AfpPopup()
    {
        let m_callFunction = ns.EmptyFunc;

        function InitializePlugin()
        {
            LocalizeElement("PopupAfpTitle", locales);
            LocalizeElement("PopupAfpTextBlockedBannersCount", locales);
            LocalizeElement("PopupAfpTextTaskDisabled", locales);
            LocalizeElement("PopupAfpTextCheckLicense", locales);
            LocalizeElement("PopupAfpTextBlockingDisabled", locales);
            LocalizeElement("PopupAfpTextBlockingDisabledOnThisSite", locales);
            LocalizeElement("PopupAfpButtonEnableTask", locales);
            LocalizeElement("PopupAfpButtonCheckLicense", locales);
            LocalizeElement("PopupAfpEnableBlockingOnSite", locales);
            LocalizeElement("PopupAfpDisableBlockingOnSite", locales);
            LocalizeElement("PopupAfpEnableBlocking", locales);
            LocalizeElement("PopupAfpDisableBlocking", locales);
            LocalizeElement("PopupAfpMenuItemSettings", locales);
            LocalizeElement("PopupAfpMenuItemHelp", locales);
            LocalizeElement("PopupAfpSmallTextBlockingDisabledOnIncompatibleSite", locales);
            LocalizeElement("PopupAfpSmallTextBlockingDisabledOnPartnerSite", locales);

            SetClickHandler("afpEnableButton", EnableAfp);
            SetClickHandler("afpCheckLicenseButton", CheckLicense);
            SetClickHandler("afpEnableOnThisSiteButton", EnableAfpOnThiSite);
            SetClickHandler("afpDisableOnThisSiteButton", DisableAfpOnThisSite);
            SetClickHandler("afpEnableBlockingButton", EnableAfpBlocking);
            SetClickHandler("afpDisableBlockingButton", DisableAfpBlocking);
            SetClickHandler("afpSettingsButton", ShowSettings);
            SetClickHandler("afpHelpButton", ShowHelp);

            SetSettings(settings);
            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    activatePlugin("afp_popup", OnPing, OnError);
                    registerMethod("afp_popup.updateSettings", SetSettings);
                });
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function OnError()
        {
            ns.ApplyStyle("afp", []);
        }

        function EnableAfp()
        {
            m_callFunction("afp_popup.enable");
        }

        function ReloadOnSuccess(result)
        {
            if (result === 0)
            {
                ApiCall(browsersApi.runtime.sendMessage)
                    .OnError(err => ns.SessionLog(`reloadActiveTab failed with error ${err.message}`))
                    .Start({ command: "reloadActiveTab" });
            }
        }

        function EnableAfpBlocking()
        {
            m_callFunction("afp_popup.enable_blocking", { enable: true }, ReloadOnSuccess);
        }

        function DisableAfpBlocking()
        {
            m_callFunction("afp_popup.enable_blocking", { enable: false }, ReloadOnSuccess);
        }

        function EnableAfpOnThiSite()
        {
            m_callFunction("afp_popup.enable_on_this_site", { enable: true }, ReloadOnSuccess);
        }

        function DisableAfpOnThisSite()
        {
            m_callFunction("afp_popup.enable_on_this_site", { enable: false }, ReloadOnSuccess);
        }

        function ShowSettings()
        {
            m_callFunction("afp_popup.settings");
        }

        function ShowHelp()
        {
            window.open(locales["PopupAfpHelpUrl"]);
        }

        function CheckLicense()
        {
            m_callFunction("afp_popup.check_license");
        }

        function CalculateCounter(afpCounters, isBlockingAllowed)
        {
            if (!afpCounters)
                return 0;

            let counter = 0;
            for (let i = 0; i < afpCounters.length; ++i)
            {
                if (isBlockingAllowed)
                    counter += afpCounters[i].blockedCount;
                else
                    counter += afpCounters[i].detectedCount;
            }

            return counter;
        }

        function SetSettings(afpSettings)
        {
            document.getElementById("AfpCounter").innerText = CalculateCounter(afpSettings.dntCounters.antiFingerprintCounters, afpSettings.isBlocking);
            const classNames = ["afp"];
            let isExpandable = false;
            let isIconEnabled = false;
            let isButtonDisabled = false;
            if (!afpSettings.isEnabled)
            {
                classNames.push("afpTaskDisabled");
            }
            else
            {
                switch (afpSettings.state)
                {
                    case 0:
                        classNames.push(afpSettings.isBlocking ? "afpBlocking" : "afpDetecting");
                        isIconEnabled = true;
                        break;
                    case 1:
                        classNames.push("afpUserDisabled");
                        break;
                    case 2:
                        classNames.push(afpSettings.isBlocking ? "afpIncompatible" : "afpIncompatibleDetecting");
                        isButtonDisabled = true;
                        break;
                    case 3:
                        classNames.push(afpSettings.isBlocking ? "afpOffAsPartner" : "afpOffAsPartnerDetecting");
                        isButtonDisabled = true;
                        break;
                    case 4:
                        classNames.push("afpCheckLicense");
                        break;
                    default:
                        break;
                }

                if (afpSettings.state < 4)
                    isExpandable = true;
            }

            document.getElementById("afpDisableOnThisSiteButton").disabled = isButtonDisabled;
            document.getElementById("AfpIcon").className = "area-icon " +
                (isIconEnabled ? "afp-area-icon afp-area-icon-Image_custom" : "afp-area-icon_disabled afp-area-icon_disabled-Image_custom");
            ns.SetAreaExpandable("AfpHeader", "AfpScrollableContent", "afpExpand", isExpandable);
            ns.ApplyStyle("afp", classNames);
        }

        InitializePlugin();
    }

    let instance = null;
    ns.RunModule(() =>
    {
        if (!instance)
            instance = new AfpPopup();
    });
});
