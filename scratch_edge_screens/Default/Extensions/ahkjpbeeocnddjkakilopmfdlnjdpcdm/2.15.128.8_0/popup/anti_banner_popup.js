AvNs.AddRunner("ab_popup", (ns, session, settings, locales) =>
{
    function AntiBannerPopup()
    {
        let m_callFunction = () => {};

        function InitializePlugin()
        {
            LocalizeElement("PopupAntiBannerTitle", locales);
            LocalizeElement("PopupAntiBannerTextCheckLicense", locales);
            LocalizeElement("PopupAntiBannerTextBlockedBannersCount", locales);
            LocalizeElement("PopupAntiBannerTextTaskDisabled", locales);
            LocalizeElement("PopupAntiBannerTextBlockingDisabledOnThisSite", locales);
            LocalizeElement("PopupAntiBannerBannersWillBeBlockedAfterPageReload", locales);
            LocalizeElement("PopupAntiBannerReloadPageToSeeAdvertisement", locales);
            LocalizeElement("PopupAntiBannerSmallTextBlockingDisabledOnIncompatibleSite", locales);
            LocalizeElement("PopupAntiBannerSmallTextBlockingDisabledOnPartnerSite", locales);
            LocalizeElement("PopupAntiBannerButtonEnableTask", locales);
            LocalizeElement("PopupAntiBannerButtonCheckLicense", locales);
            LocalizeElement("PopupAntiBannerButtonCheckSubscription", locales);
            LocalizeElement("PopupAntiBannerMenuItemEnableBlockingOnSite", locales);
            LocalizeElement("PopupAntiBannerMenuItemDisableBlockingOnSite", locales);
            LocalizeElement("PopupAntiBannerMenuItemDisableTask", locales);
            LocalizeElement("PopupAntiBannerMenuItemSettings", locales);
            LocalizeElement("PopupAntiBannerMenuItemHelp", locales);

            SetClickHandler("abEnableOnThisSiteButton", EnableAntiBannerOnThiSite);
            SetClickHandler("abDisableOnThisSiteButton", DisableAntiBannerOnThisSite);
            SetClickHandler("abDisableButton", DisableAntiBanner);
            SetClickHandler("abSettingsButton", ShowSettings);
            SetClickHandler("abHelpButton", ShowHelp);
            SetClickHandler("abEnableButton", EnableAntiBanner);
            SetClickHandler("abCheckLicenseButton", CheckLicense);
            SetClickHandler("abCheckSubscritionButton", ExtendSubscription);

            SetSettings(settings);
            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    activatePlugin("ab_popup", OnPing, OnError);
                    registerMethod("ab_popup.updateSettings", SetSettings);
                });
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function OnError()
        {
            ns.ApplyStyle("ab", []);
        }

        function EnableAntiBanner()
        {
            m_callFunction("ab_popup.enable", { enable: true });
        }

        function DisableAntiBanner()
        {
            m_callFunction("ab_popup.enable", { enable: false });
        }

        function EnableAntiBannerOnThiSite()
        {
            m_callFunction("ab_popup.enable_on_this_site", { enable: true });
        }

        function DisableAntiBannerOnThisSite()
        {
            m_callFunction("ab_popup.enable_on_this_site", { enable: false });
        }

        function ShowSettings()
        {
            m_callFunction("ab_popup.settings");
        }

        function ShowHelp()
        {
            window.open(locales["PopupAntiBannerHelpUrl"]);
        }

        function CheckLicense()
        {
            m_callFunction("ab_popup.check_license");
        }

        function ExtendSubscription()
        {
            m_callFunction("ab_popup.extend_subscription");
        }

        function SetSettings(abSettings)
        {
            document.getElementById("AntiBannerCounter").innerText = abSettings.counter;
            const classNames = ["ab"];
            let isExpandable = false;
            let isIconEnabled = false;
            let isButtonDisabled = false;
            if (!abSettings.isEnabled)
            {
                classNames.push("abTaskOff");
            }
            else
            {
                switch (abSettings.state)
                {
                    case 0:
                        classNames.push(abSettings.isNeedRefresh ? "abEnabledAfterReload" : "abBlocking");
                        isIconEnabled = true;
                        break;
                    case 1:
                        classNames.push(abSettings.isNeedRefresh ? "abDisabledAfterReload" : "abOffByUser");
                        break;
                    case 2:
                        classNames.push("abOffAsIncompatible");
                        isButtonDisabled = true;
                        break;
                    case 3:
                        classNames.push("abOffAsPartner");
                        isButtonDisabled = true;
                        break;
                    case 4:
                        classNames.push("abCheckLicense");
                        break;
                    case 5:
                        classNames.push("abRestrictionSubscription");
                        break;
                    default:
                        break;
                }

                if (abSettings.state < 4)
                    isExpandable = true;
            }

            document.getElementById("abDisableOnThisSiteButton").disabled = isButtonDisabled;
            document.getElementById("AbIcon").className = "area-icon " +
                (isIconEnabled ? "antibanner-area-icon antibanner-area-icon-Image_custom" : "antibanner-area-icon_disabled antibanner-area-icon_disabled-Image_custom");
            ns.SetAreaExpandable("AbHeader", "AbScrollableContent", "abExpand", isExpandable);
            ns.ApplyStyle("ab", classNames);
        }

        InitializePlugin();
    }

    let instance = null;
    ns.RunModule(() =>
    {
        if (!instance)
            instance = new AntiBannerPopup();
    });
});
