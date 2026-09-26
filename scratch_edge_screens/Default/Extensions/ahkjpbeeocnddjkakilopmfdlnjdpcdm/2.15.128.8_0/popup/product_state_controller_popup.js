AvNs.AddRunner("psc_popup", (ns, session, settings, locales) =>
{
    function ProductStateControllerPopup()
    {
        let m_callFunction = ns.EmptyFunc;
        const m_currentStyles = [];

        function ProtectionDisabledBanner()
        {
            this.Show = problemId =>
            {
                m_currentStyles.push("noProtectionBanner");
                const localeName = `PopupProtectionDisabled${m_problems[problemId - 1]}Title`;
                document.getElementById("PopupProtectionDisabledTitle").innerText = locales[localeName];
            };

            function OnProtectionDisabledButtonClick()
            {
                m_callFunction("psc_popup.open_product");
            }

            function OnHelpInfoReturnButtonClick()
            {
                document.getElementById("PopupHelpInfoImage").className = "helpInfoImage";
                ns.ApplyStyle("psc", m_currentStyles);
            }

            function Initialize()
            {
                SetClickHandler("PopupProtectionDisabledButton", OnProtectionDisabledButtonClick);
                SetClickHandler("PopupHelpInfoReturnButton", OnHelpInfoReturnButtonClick);
            }
            Initialize();
        }
        const m_protectionDisabledBanner = new ProtectionDisabledBanner();

        const m_problems = ["NoProtection", "NoLicense", "LimitedLicense", "GracePeriod", "UpdateFailed"];
        const m_controllers = [
            { name: "Webav", style: "webavMac", id: 0 },
            { name: "Dnt", style: "dntMac", id: 1 },
            { name: "Ca", style: "caMac", id: 2 },
            { name: "SafeMoney", style: "safeMoneyMac", id: 3 },
            { name: "DupPassword", style: "dupPasswordMac", id: 4 },
            { name: "Pc", style: "pcMac", id: 5 },
            { name: "UrlAdv", style: "urlAdvMac", id: 6 },
            { name: "Vk", style: "vkMac", id: 7 }
        ];

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function OnError()
        {
            ns.ApplyStyle("psc", []);
        }

        function AddController(task, state)
        {
            let m_enabled = state.enabled;
            const m_element = document.getElementById(`Popup${task.name}MacSwitch`);

            function OnSwitchClick()
            {
                m_element.checked = !m_element.checked;
                m_element.disabled = true;
                m_callFunction("psc_popup.set_task_state", { task: task.id, enabled: !m_enabled }, res => 
                    { 
                        m_element.disabled = false; 
                        if (res)    
                            return; 
                        m_enabled = !m_enabled;
                        m_element.checked = m_enabled;
                    });
            }

            function OnOpenHelpInfoClick()
            {
                ns.ApplyStyle("psc", ["helpInfoMac"]);
                document.getElementById("PopupHelpInfoImage").className += ` ${task.name}-helpInfoImage`;
                document.getElementById("PopupHelpInfoTitle").innerText = locales[`Popup${task.name}MacHelpInfoTitle`];
                document.getElementById("PopupHelpInfoDescription").innerText = locales[`Popup${task.name}MacHelpInfoDescription`];
            }

            function Initialize()
            {
                SetClickHandler(`Popup${task.name}MacSwitch`, OnSwitchClick);
                SetClickHandler(`Popup${task.name}MacHelpInfoButton`, OnOpenHelpInfoClick);
                m_currentStyles.push(task.style);
                m_element.checked = state.enabled;
                m_element.disabled = state.blockToModify;
            }
            Initialize();
        }

        function SetSettings(pscSettings)
        {
            let i = 0;
            for (const task of pscSettings.tasks)
            {
                AddController(m_controllers[task], pscSettings.states[i]);
                i++;
            }
            if (pscSettings.productStatus > 0)
                m_protectionDisabledBanner.Show(pscSettings.productStatus);
            ns.ApplyStyle("psc", m_currentStyles);
        }

        function InitializePlugin()
        {
            LocalizeElement("PopupWebavMacTitle", locales);
            LocalizeElement("PopupDntMacTitle", locales);
            LocalizeElement("PopupDntMacTotalAttemptsBlocked", locales);
            LocalizeElement("PopupDntMacTotalAttemptsNotBlocked", locales);
            LocalizeElement("PopupDntMacFullReportLabelText", locales);
            LocalizeElement("PopupCaMacTitle", locales);
            LocalizeElement("PopupSafeMoneyMacTitle", locales);
            LocalizeElement("PopupDupPasswordMacTitle", locales);
            LocalizeElement("PopupPcMacTitle", locales);
            LocalizeElement("PopupUrlAdvMacTitle", locales);
            LocalizeElement("PopupVkMacTitle", locales);
            LocalizeElement("PopupVkMacOpenButtonText", locales);
            LocalizeElement("PopupProtectionDisabledButtonText", locales);

            SetSettings(settings);
            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    activatePlugin("psc_popup", OnPing, OnError);
                });
        }

        InitializePlugin();
    }

    const instance = new ProductStateControllerPopup();
});
