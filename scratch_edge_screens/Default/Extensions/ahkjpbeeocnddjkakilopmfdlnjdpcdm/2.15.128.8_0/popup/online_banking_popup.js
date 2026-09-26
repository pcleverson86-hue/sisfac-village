AvNs.AddRunner("ob_popup", (ns, session, settings, locales) =>
{
    function OnlineBankingPopup()
    {
        let m_callFunction = ns.EmptyFunc;

        function InitializePlugin()
        {
            LocalizeElement("PopupOnlineBankingTitle", locales);
            LocalizeElement("PopupOnlineBankingDescription", locales);
            LocalizeElement("PopupOnlineBankingDescriptionProtected", locales);
            LocalizeElement("PopupOnlineBankingSubscription", locales);
            LocalizeElement("PopupOnlineBankingAgreementToCopy", locales);
            LocalizeElement("PopupOnlineBankingAgreementDescription", locales);
            LocalizeElement("PopupOnlineBankingOpenButtonText", locales);
            LocalizeElement("PopupOnlineBankingInactiveOpenButtonText", locales);
            LocalizeElement("PopupOnlineBankingInactiveOpenButtonDescriptionText", locales);

            SetClickHandler("PopupOnlineBankingOpenButton", OpenProtectedMode);

            SetSettings(settings);
            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    activatePlugin("ob_popup", OnPing, OnError);
                });
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function OnError()
        {
            ns.ApplyStyle("ob_popup", []);
        }

        function ReloadIfNeed(result, args)
        {
            if (result === 0 && args && args.action === 1)
            {
                ApiCall(browsersApi.runtime.sendMessage)
                    .OnError(err => ns.SessionLog(`reloadActiveTab failed with error ${err.message}`))
                    .Start({ command: "reloadActiveTab" });
            }
        }

        function OpenProtectedMode()
        {
            const agreementToCopy = document.getElementById("PopupOnlineBankingAgreementCheckbox").checked;
            m_callFunction("ob_popup.openProtectedMode", { hasAgreementToCopy: agreementToCopy }, ReloadIfNeed);
        }

        function SendTabUrl()
        {
            ApiCall(browsersApi.tabs.query)
                .OnSuccess(tabs =>
                    {
                        if (tabs.length > 0)
                            m_callFunction("ob_popup.updateSettings", { url: tabs[0].url }, SetSettings);
                    })
                .OnError(err => ns.SessionError(err, "ob_popup"))
                .Start(AvNs.QueryActiveTabFromPopupArgs);
        }

        function SetSettings(obSettings)
        {
            if (!obSettings)
                return;

            const classNames = ["ob"];
            let isIconEnabled = true;
            let needToSendUrl = false;

            if (obSettings.isSubscription)
            {
                classNames.push("obSubscription");
                isIconEnabled = false;
            }
            else if (!obSettings.isTabExist)
            {
                classNames.push("obNotAvailableProtectMode");
                needToSendUrl = true;
            }
            else if (obSettings.isSafeBrowser)
            {
                classNames.push("obProtectMode");
            }
            else if (obSettings.isAvailable)
            {
                if (obSettings.isFirstStart)
                    classNames.push("obAvailableProtectModeFirstStart");
                else
                    classNames.push("obAvailableProtectModeNotFirstStart");
            }
            else
            {
                classNames.push("obNotAvailableProtectMode");
            }

            document.getElementById("ObIcon").className = "area-icon " +
                (isIconEnabled ? "ob-area-icon ob-area-icon-Image_custom" : "ob-area-icon_disabled ob-area-icon_disabled-Image_custom");

            ns.ApplyStyle("ob", classNames);

            if (needToSendUrl)
                SendTabUrl();
        }

        InitializePlugin();
    }

    let instance = null;
    ns.RunModule(() =>
    {
        if (!instance)
            instance = new OnlineBankingPopup();
    });
});
