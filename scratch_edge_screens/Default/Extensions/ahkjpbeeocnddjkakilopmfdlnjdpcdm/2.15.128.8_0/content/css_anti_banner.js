AvNs.AddEventListener(document, "click", function onClick(event)
    {
        if (!AvNs.IsValidTargetProperty(event) || !event.target.closest)
            return;

        var element = event.target.closest("a[href]");
        if (element !== null && typeof element.href === "string")
        {
            ApiCall(browsersApi.runtime.sendMessage)
                .OnError(err => AvNs.SessionLog(`sendPopupUrl failed with error ${err.message}`))
                .Start({ command: "sendPopupUrl", url: element.href });
        }
        else
        {
            ApiCall(browsersApi.runtime.sendMessage)
                .OnError(err => AvNs.SessionLog(`sendPopupUrl empty url failed with error ${err.message}`))
                .Start({ command: "sendPopupUrl", url: "" });
        }
    }, "abn");

function GetCommonLink()
{
    var commonLink = AvNs.GetResourceSrc("/abn/main.css");
    if (!AvNs.IsRelativeTransport())
        return commonLink;

    return "/" + commonLink.substr(AvNs.GetBaseUrl().length);
}

function FindCommonLink()
{
    if (document.querySelector)
        return document.querySelector("link[href^=\"" + GetCommonLink() + "\"]");

    for (var i = 0; i < AvNs.documentStyleSheets.length; ++i)
    {
        var currentStyleSheet = AvNs.documentStyleSheets[i];
        if (currentStyleSheet.href && currentStyleSheet.href.indexOf(GetCommonLink()) !== -1)
            return AvNs.documentStyleSheets[i].ownerNode || AvNs.documentStyleSheets[i].owningElement;
    }

    return null;
}

var abnRunner = function abnRunner(ns, session, settings)
{
    function AntiBanner()
    {
        var m_callFunction = ns.EmptyFunc;
        var m_usingStyles = [];
        var m_deferredProcess = null;
        var m_processedIdentifier = "kl_abn_" + ns.GetCurrentTime();
        var m_firstRun = true;
        var m_randColorAttribute = settings.randomColor;
        var m_randBackgroundColorAttribute = settings.randomBackgroundColor;
        var m_observer = null;
        var m_abpRulesApplyTimeout = null;
        var m_pluginId = "abn";

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function GetStyleSheetFromNode(node)
        {
            return node.sheet || node.styleSheet;
        }

        function AddAntiBannerStyleSheet(styleSheet)
        {
            if (!styleSheet)
                return;

            m_usingStyles.push(styleSheet);
        }

        function AddUsingStyle(sheetNodes)
        {
            for (var i = 0; i < ns.documentStyleSheets.length; ++i)
            {
                var ownerNode = ns.GetOwnerNode(ns.documentStyleSheets[i]);
                if (sheetNodes.indexOf(ownerNode) !== -1)
                    AddAntiBannerStyleSheet(ns.documentStyleSheets[i]);
            }
        }

        function SendAntibannerStat(newProcessedCount)
        {
            if (m_firstRun || newProcessedCount !== 0)
            {
                m_callFunction("abn.statInfo", { count: newProcessedCount });
                m_firstRun = false;
            }
        }

        function ApplyAbpRulesDelay(rule)
        {
            ns.SetTimeout(function ApplyAbpRulesTimerCallback()
                {
                    var elements = ns.FindElementsByAbpRule(rule);
                    var newProcessedCount = 0;
                    for (var i = 0; i < elements.length; ++i)
                    {
                        if (!elements[i][m_processedIdentifier])
                        {
                            elements[i][m_processedIdentifier] = true;
                            elements[i].style.display = "none";
                            ++newProcessedCount;
                        }
                    }
                    if (newProcessedCount)
                        SendAntibannerStat(newProcessedCount);
                }, 0, m_pluginId);
        }

        function ApplyAbpRules(rules)
        {
            if (!ns.FindElementsByAbpRule)
            {
                ns.SessionError("Function for abp rules is not defined", m_pluginId);
                return;
            }

            for (var i = 0; i < rules.length; i++)
                ApplyAbpRulesDelay(rules[i]);
        }

        function CalculateNewProcessedItemsBySelector(selector)
        {
            var newProcessedCount = 0;
            var elementList = ns.DocumentQuerySelectorAll(selector);
            for (var i = 0; i < elementList.length; ++i)
            {
                if (!elementList[i][m_processedIdentifier])
                {
                    elementList[i][m_processedIdentifier] = true;
                    ++newProcessedCount;
                }
            }
            return newProcessedCount;
        }

        function CheckSelectors(selector)
        {
            try
            {
                var selectorsArray = ns.StringSplit.call(selector, ",");
                for (var i = 0; i < selectorsArray.length; ++i)
                {
                    try
                    {
                        document.querySelector(selectorsArray[i]);
                    }
                    catch (e)
                    {
                        var detailsObject = {
                            cssRule: selectorsArray[i],
                            originalMessage: e.message
                        };
                        var errorObject = {
                            message: "Wrong selector",
                            details: JSON.stringify(detailsObject),
                            stack: e.stack
                        };
                        ns.SessionError(errorObject, m_pluginId);
                    }
                }
            }
            catch (err)
            {
                ns.SessionError(err, m_pluginId);
            }
        }

        function DeferredProcessCssRules(rules, i)
        {
            try
            {
                if (!rules[i].selectorText)
                {
                    ns.SessionLog("Ignore rule " + i + " cause it empty");
                    return;
                }
                SendAntibannerStat(CalculateNewProcessedItemsBySelector(rules[i].selectorText));
            }
            catch (e)
            {
                if (e.message && (e.message === "SyntaxError" || (e.message.includes && e.message.includes("is not a valid selector"))))
                    CheckSelectors(rules[i].selectorText);
                else
                    ns.SessionError(e);
            }
        }

        function GetDeferredHandler(rules, i)
        {
            return function GetDeferredHandlerImpl() { DeferredProcessCssRules(rules, i); };
        }

        function ProcessCssRules(rules)
        {
            for (var i = 0; i < rules.length; ++i)
                ns.SetTimeout(GetDeferredHandler(rules, i), 0, m_pluginId);
        }

        function CalculateNewProcessedItemsByStyle()
        {
            var newProcessedCount = 0;
            var elementList = document.getElementsByTagName("*");
            for (var i = 0; i < elementList.length; ++i)
            {
                if (!elementList[i][m_processedIdentifier]
                    && elementList[i].currentStyle.color === m_randColorAttribute
                    && elementList[i].currentStyle.backgroundColor === m_randBackgroundColorAttribute)
                {
                    elementList[i][m_processedIdentifier] = true;
                    ++newProcessedCount;
                }
            }
            return newProcessedCount;
        }

        function CalculateNewProcessedItems()
        {
            if (ns.HasDocumentQuerySelectorAll())
            {
                var atLeastOneStyleExist = false;
                for (var i = 0; i < m_usingStyles.length; ++i)
                {
                    try
                    {
                        var cssRules = m_usingStyles[i].cssRules || m_usingStyles[i].rules;
                        if (cssRules && cssRules.length)
                        {
                            ProcessCssRules(cssRules);
                            atLeastOneStyleExist = true;
                        }
                    }
                    catch (e)
                    {
                        ns.SessionLog(e);
                    }
                }
                if (!atLeastOneStyleExist)
                {
                    SendAntibannerStat(0);
                    ns.SessionLog("No one style exist. Count of using styles nodes: " + m_usingStyles.length);
                }
            }
            else
            {
                SendAntibannerStat(CalculateNewProcessedItemsByStyle());
            }
        }

        function ScheduleCalculateProcessedItems()
        {
            ns.ClearTimeout(m_deferredProcess);
            m_deferredProcess = ns.SetTimeout(CalculateNewProcessedItems, 500, m_pluginId);
        }

        function SetCss(rules)
        {
            if (rules.rules)
            {
                var sheetNodes = ns.AddStyles(rules.rules);
                ns.SetTimeout(function SetCssTimerCallback() { AddUsingStyle(sheetNodes); }, 0, m_pluginId);
            }

            if (rules.abpRules && rules.abpRules.length)
            {
                var applyRulesFunc = function ApplyAbpRulesFunc() { ApplyAbpRules(rules.abpRules); };
                applyRulesFunc();
                ns.AddEventListener(window, "load", applyRulesFunc, m_pluginId);
                if (m_observer)
                    m_observer.Stop();
                m_observer = ns.GetDomChangeObserver("*", m_pluginId);
                m_observer.Start(function AntiBannerMutationObserver()
                    {
                        ns.ClearTimeout(m_abpRulesApplyTimeout);
                        m_abpRulesApplyTimeout = ns.SetTimeout(applyRulesFunc, 2000, m_pluginId);
                    });
            }

            ns.SessionLog("Calculate processed items when setting css");
            ScheduleCalculateProcessedItems();
        }

        function OnLoadCommonCss(arg, secondChance)
        {
            var target = arg.target || arg.srcElement;
            var processLoadedSheetNode = function processLoadedSheetNode(sheetNode)
            {
                AddAntiBannerStyleSheet(sheetNode);
                ns.SessionLog("Calculate processed items when loading common css");
                ScheduleCalculateProcessedItems();
            };
            var sheetNode = GetStyleSheetFromNode(target);
            if (sheetNode)
            {
                processLoadedSheetNode(sheetNode);
            }
            else if (secondChance)
            {
                ns.SessionError("OnLoadCommonCss fail with not exist sheet", m_pluginId);
            }
            else
            {
                ns.SessionLog("Sheet doesn't exist for link element. Second try after one second");
                ns.SetTimeout(function SecondChanceForLoadCss() { OnLoadCommonCss(arg, true); }, 1000, m_pluginId);
            }
        }

        session.InitializePlugin(
            function InitializePluginABN(activatePlugin, registerMethod, callFunction)
            {
                m_callFunction = callFunction;
                activatePlugin(m_pluginId, OnPing);
            }
            );

        if (settings.insertCommonLink)
        {
            var link = ns.DocumentCreateElement("link");
            ns.ElementSetAttribute.call(link, "type", "text/css");
            ns.ElementSetAttribute.call(link, "rel", "stylesheet");
            ns.ElementSetAttribute.call(link, "href", ns.GetResourceSrc("/abn/main.css"));
            ns.ElementSetAttribute.call(link, "crossorigin", "anonymous");
            ns.AddEventListener(link, "load", OnLoadCommonCss, m_pluginId);
            if (document.head)
                ns.AppendChild(document.head, link);
            else
                ns.AppendChild(document.getElementsByTagName("head")[0], link);
        }

        SetCss(settings);
    }


    var instance = null;
    ns.RunModule(function RunModuleAB()
    {
        if (!instance)
            instance = new AntiBanner();
    });
};

var abnOptions = {
    name: "abn",
    runner: abnRunner,
    getParameters: function getParameters() { return { isCssUrlInjected: Boolean(FindCommonLink()) }; }
};

AvNs.AddRunner2(abnOptions);
