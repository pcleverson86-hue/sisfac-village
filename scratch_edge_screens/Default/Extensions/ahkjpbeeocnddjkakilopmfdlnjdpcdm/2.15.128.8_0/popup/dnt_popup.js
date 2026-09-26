AvNs.AddRunner("dnt_popup", (ns, session, settings, locales) =>
{
    function DntBannerPopup()
    {
        let m_callFunction = ns.EmptyFunc;
        let m_socialNetworkExpanded = false;
        let m_webAnalyticsExpanded = false;
        let m_adAgenciesExpanded = false;
        let m_webBugsExpanded = false;

        function InitializePlugin()
        {
            LocalizeElement("PopupDntTitle", locales);
            LocalizeElement("PopupDntTextCheckLicense", locales);
            LocalizeElement("PopupDntTextTaskDisabled", locales);
            LocalizeElement("PopupDntTextBlockingDisabled", locales);
            LocalizeElement("PopupDntTextBlockingDisabledOnThisSite", locales);
            LocalizeElement("PopupDntTextBlockedTrackersCount", locales);
            LocalizeElement("PopupDntTextDetectedTrackersCount", locales);
            LocalizeElement("PopupDntSmallTextBlockingDisabledOnIncompatibleSite", locales);
            LocalizeElement("PopupDntSmallTextBlockingDisabledOnPartnerSite", locales);
            LocalizeElement("PopupDntButtonEnableTask", locales);
            LocalizeElement("PopupDntButtonCheckLicense", locales);
            LocalizeElement("PopupDntButtonCheckSubscription", locales);
            LocalizeElement("PopupDntCategoryTitleSocialNetworks", locales);
            LocalizeElement("PopupDntCategoryTitleWebAnalytics", locales);
            LocalizeElement("PopupDntCategoryTitleWebBugs", locales);
            LocalizeElement("PopupDntCategoryTitleAdAgencies", locales);
            LocalizeElement("PopupDntCategoryTitleNoteNotBlocked", locales);
            LocalizeElement("PopupDntCategoryTitleNotePartiallyBlocked", locales);
            LocalizeElement("PopupDntMenuItemShowBlockingFailures", locales);
            LocalizeElement("PopupDntMenuItemEnableBlockingOnThisSite", locales);
            LocalizeElement("PopupDntMenuItemDisableBlockingOnThisSite", locales);
            LocalizeElement("PopupDntMenuItemEnableBlocking", locales);
            LocalizeElement("PopupDntMenuItemDisableBlocking", locales);
            LocalizeElement("PopupDntMenuItemSettings", locales);
            LocalizeElement("PopupDntMenuItemHelp", locales);

            SetClickHandler("dntEnableButton", EnableDnt);
            SetClickHandler("dntEnableOnThisSiteButton", EnableDntOnThiSite);
            SetClickHandler("dntDisableOnThisSiteButton", DisableDntOnThisSite);
            SetClickHandler("dntEnableBlockingButton", EnableDntBlocking);
            SetClickHandler("dntDisableBlockingButton", DisableDntBlocking);
            SetClickHandler("dntSettingsButton", ShowSettings);
            SetClickHandler("dntHelpButton", ShowHelp);
            SetClickHandler("dntShowBlockingFailuresButton", ShowReport);
            SetClickHandler("dntCheckLicenseButton", CheckLicense);
            SetClickHandler("dntCheckSubscritionButton", ExtendSubscription);

            SetClickHandler("socialNetworkHeader", OnExpandSocialNetwork);
            SetClickHandler("webAnalyticsHeader", OnExpandWebAnalytics);
            SetClickHandler("adAgenciesHeader", OnExpandAdAgencies);
            SetClickHandler("webBugsHeader", OnExpandWebBugs);

            SetSettings(settings);
            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    activatePlugin("dnt_popup", OnPing, OnError);
                    registerMethod("dnt_popup.updateSettings", SetSettings);
                });
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function OnError()
        {
            ns.ApplyStyle("dnt", []);
        }

        function EnableDnt()
        {
            m_callFunction("dnt_popup.enable");
        }

        function ReloadOnSuccess(result)
        {
            if (result === 0)
            {
                ApiCall(browsersApi.runtime.sendMessage)
                    .OnError(err => ns.Log(`reloadActiveTab failed with error ${err.message}`))
                    .Start({ command: "reloadActiveTab" });
            }
        }

        function EnableDntBlocking()
        {
            m_callFunction("dnt_popup.enable_blocking", { enable: true }, ReloadOnSuccess);
        }

        function DisableDntBlocking()
        {
            m_callFunction("dnt_popup.enable_blocking", { enable: false }, ReloadOnSuccess);
        }

        function EnableDntOnThiSite()
        {
            m_callFunction("dnt_popup.enable_on_this_site", { enable: true }, ReloadOnSuccess);
        }

        function DisableDntOnThisSite()
        {
            m_callFunction("dnt_popup.enable_on_this_site", { enable: false }, ReloadOnSuccess);
        }

        function ShowSettings()
        {
            m_callFunction("dnt_popup.settings");
        }

        function ShowHelp()
        {
            window.open(locales["PopupDntHelpUrl"]);
        }

        function ShowReport()
        {
            m_callFunction("dnt_popup.reports");
        }

        function CheckLicense()
        {
            m_callFunction("dnt_popup.check_license");
        }

        function ExtendSubscription()
        {
            m_callFunction("dnt_popup.extend_subscription");
        }

        function GetExpandButtonClass(flagExpanded)
        {
            return "dnt-category-expandButton dnt-category-expandButton-Image_custom" +
                (flagExpanded ? " dnt-category-expandButton_expanded dnt-category-expandButton_expanded-Image_custom" : "");
        }

        function GetExpandHeaderClass(flagExpanded)
        {
            return "dnt-category" + (flagExpanded ? " dntCategoryExpanded" : "");
        }

        function SetExpandedClasses()
        {
            document.getElementById("socialNetworkButton").className = GetExpandButtonClass(m_socialNetworkExpanded);
            document.getElementById("socialNetworkButton").parentElement.parentElement.className = GetExpandHeaderClass(m_socialNetworkExpanded);
            document.getElementById("webAnalyticsButton").className = GetExpandButtonClass(m_webAnalyticsExpanded);
            document.getElementById("webAnalyticsButton").parentElement.parentElement.className = GetExpandHeaderClass(m_webAnalyticsExpanded);
            document.getElementById("adAgenciesButton").className = GetExpandButtonClass(m_adAgenciesExpanded);
            document.getElementById("adAgenciesButton").parentElement.parentElement.className = GetExpandHeaderClass(m_adAgenciesExpanded);
            document.getElementById("webBugsButton").className = GetExpandButtonClass(m_webBugsExpanded);
            document.getElementById("webBugsButton").parentElement.parentElement.className = GetExpandHeaderClass(m_webBugsExpanded);
        }

        function OnExpandSocialNetwork()
        {
            m_socialNetworkExpanded = !m_socialNetworkExpanded;
            m_webAnalyticsExpanded = false;
            m_adAgenciesExpanded = false;
            m_webBugsExpanded = false;
            SetExpandedClasses();
        }

        function OnExpandWebAnalytics()
        {
            m_socialNetworkExpanded = false;
            m_webAnalyticsExpanded = !m_webAnalyticsExpanded;
            m_adAgenciesExpanded = false;
            m_webBugsExpanded = false;
            SetExpandedClasses();
        }

        function OnExpandAdAgencies()
        {
            m_socialNetworkExpanded = false;
            m_webAnalyticsExpanded = false;
            m_adAgenciesExpanded = !m_adAgenciesExpanded;
            m_webBugsExpanded = false;
            SetExpandedClasses();
        }

        function OnExpandWebBugs()
        {
            m_socialNetworkExpanded = false;
            m_webAnalyticsExpanded = false;
            m_adAgenciesExpanded = false;
            m_webBugsExpanded = !m_webBugsExpanded;
            SetExpandedClasses();
        }

        function ApplyDntCategory(idPrefix, classPrefix, trackers, isBlockingAllowed, socialNetworks)
        {
            const categoryRoot = document.getElementById(idPrefix + "Trackers");
            while (categoryRoot.firstChild)
                categoryRoot.removeChild(categoryRoot.firstChild);

            let sumCounter = 0;
            let failureCounter = 0;
            let isBlockingAllowedCounter = 0;

            for (let i = 0; i < trackers.length; ++i)
            {
                if (trackers[i].blockFailedCount)
                    ++failureCounter;

                const liElement = document.createElement("li");
                liElement.className = "optional-block " + (trackers[i].blockFailedCount ? "dnt-tracker-name" : "dnt-tracker-name-blocked");
                liElement.appendChild(document.createElement("span").appendChild(document.createTextNode(trackers[i].serviceName)));    
                liElement.appendChild(document.createElement("span").appendChild(document.createTextNode(": ")));   

                const trackerCountElement = document.createElement("span");
                trackerCountElement.appendChild(document.createTextNode(trackers[i].blockedCount + trackers[i].detectedCount + trackers[i].blockFailedCount));
                trackerCountElement.className = "dnt-tracker-counter";
                liElement.appendChild(trackerCountElement);

                const socialNetwork = socialNetworks.find(element => element.serviceName === trackers[i].serviceName);
                if (socialNetwork && !socialNetwork.isBlocked)
                {
                    isBlockingAllowedCounter++;
                    const isBlockingAllowedElement = document.createElement("span");
                    isBlockingAllowedElement.appendChild(document.createTextNode(" " + locales["PopupDntCategoryTitleNoteNotBlocked"]));
                    liElement.appendChild(isBlockingAllowedElement);
                }

                categoryRoot.appendChild(liElement);
                sumCounter += trackers[i].blockedCount + trackers[i].detectedCount + trackers[i].blockFailedCount;
            }

            let isPartiallyBlocked = false;
            let isNotBlocked = !isBlockingAllowed;
            if (isBlockingAllowedCounter > 0)
            {
                if (isBlockingAllowedCounter !== trackers.length)
                    isPartiallyBlocked = true;
                else
                    isNotBlocked = true;
            }

            document.getElementById(idPrefix + "Icon").className = ((trackers.length > 0 && failureCounter === trackers.length) || isNotBlocked)
                ? "dnt-category-icon dnt-category-icon_disabled " + classPrefix + "_disabled "  + classPrefix + "_disabled-Image_custom"
                : "dnt-category-icon " + classPrefix + "_enabled " + classPrefix + "_enabled-Image_custom";
            if ((trackers.length > 0 && failureCounter === trackers.length) || isNotBlocked)
            {
                document.getElementById(idPrefix + "Header").className = "dnt-category-header DntCategoryNotBlocked";
                if (isNotBlocked)
                    document.getElementById(idPrefix + "Header").className += " PopupDntCategoryTitleNoteNotBlocked";
            }
            else if (failureCounter !== 0 || isPartiallyBlocked)
            {
                document.getElementById(idPrefix + "Header").className = "dnt-category-header DntCategoryPartiallyBlocked";
                if (isPartiallyBlocked)
                    document.getElementById(idPrefix + "Header").className += " PopupDntCategoryTitleNotePartiallyBlocked";
            }
            else
            {
                document.getElementById(idPrefix + "Header").className = "dnt-category-header";
            }
            document.getElementById(idPrefix + "Counter").innerText = sumCounter;
            return sumCounter;
        }

        function ApplyDntCategories(dntSettings)
        {
            let sumCounter = 0;
            sumCounter += ApplyDntCategory("socialNetwork", "social-networks", dntSettings.dntCounters.socialNetworksCounters || [], true, dntSettings.blockSocialNetworks || []);
            sumCounter += ApplyDntCategory("webAnalytics", "web-analytics", dntSettings.dntCounters.webAnalyticsCounters || [], dntSettings.blockWebAnalytics, []);
            sumCounter += ApplyDntCategory("adAgencies", "ad-agencies", dntSettings.dntCounters.adAgencyCounters || [], dntSettings.blockAdAgencies, []);
            sumCounter += ApplyDntCategory("webBugs", "web-bugs", dntSettings.dntCounters.webBugCounters || [], dntSettings.blockWebBugs, []);
            document.getElementById("DntCounter").innerText = sumCounter;
        }

        function FailureByCategory(trackers)
        {
            for (const tracker of trackers)
            {
                if (tracker.blockFailedCount)
                    return true;
            }
            return false;
        }

        function BlockingFailure(dntCounters)
        {
            return FailureByCategory(dntCounters.socialNetworksCounters || [])
                || FailureByCategory(dntCounters.webAnalyticsCounters || [])
                || FailureByCategory(dntCounters.adAgencyCounters || [])
                || FailureByCategory(dntCounters.webBugCounters || []);
        }

        function SetSettings(dntSettings)
        {
            const classNames = ["dnt"];
            let isExpandable = true;
            let disableButton = false;
            let iconDisabled = true;
            if (!dntSettings.isEnabled)
            {
                classNames.push("dntTaskDisabled");
                isExpandable = false;
            }
            else
            {
                switch (dntSettings.state)
                {
                case 0:
                    classNames.push(dntSettings.isBlocking ? "dntBlocking" : "dntDetecting");
                    classNames.push("DntCategory");
                    iconDisabled = false;
                    break;
                case 1:
                    classNames.push("dntUserDisabled");
                    classNames.push("DntCategory");
                    break;
                case 2:
                    classNames.push(dntSettings.isBlocking ? "dntIncompatible" : "dntIncompatibleDetecting");
                    classNames.push("DntCategory");
                    disableButton = true;
                    break;
                case 3:
                    classNames.push(dntSettings.isBlocking ? "dntOffAsPartner" : "dntOffAsPartnerDetecting");
                    disableButton = true;
                    break;
                case 4:
                    classNames.push("dntCheckLicense");
                    isExpandable = false;
                    break;
                case 5:
                    classNames.push("dntRestrictionSubscription");
                    isExpandable = false;
                    break;
                default:
                    break;
                }
                if (BlockingFailure(dntSettings.dntCounters))
                    classNames.push("dntFail");
            }

            document.getElementById("dntDisableOnThisSiteButton").disabled = disableButton;
            document.getElementById("DntIcon").className = "area-icon " +
                (iconDisabled ? "dnt-area-icon_disabled dnt-area-icon_disabled-Image_custom" : "dnt-area-icon dnt-area-icon-Image_custom");
            ApplyDntCategories(dntSettings);
            ns.ApplyStyle("dnt", classNames);
            ns.SetAreaExpandable("DntHeader", "DntScrollableContent", "dntExpand", isExpandable);
        }

        InitializePlugin();
    }

    let instance = null;
    ns.RunModule(() =>
    {
        if (!instance)
            instance = new DntBannerPopup();
    });
});
