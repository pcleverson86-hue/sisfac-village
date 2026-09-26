(function UserFeedbackBackground()
{
let instance = null;

function RunnerImpl(ns, session)
{
    function UserFeedbackBackgroundImpl()
    {
        const m_pluginId = "ufb";
        const m_redirects = new Map();
        const m_beforeRedirectMap = new Map();

        const userTransitionTypesToClearRedirects = new Set(["auto_bookmark", "typed", "generated", "form_submit", "reload"]);
        const userTransitionQualifiersToClearRedirects = new Set(["from_address_bar", "forward_back"]);

        const m_phfbWindow = new ns.PopupWindow("phfb", session, "/ufb/phishing_user_feedback_window.html", "/ufb/popup_window.css");
        const m_bwfbWindow = new ns.PopupWindow("bwfb", session, "/ufb/broken_webpage_user_feedback_window.html", "/ufb/popup_window.css");

        let m_callFunction = () => {};
        let m_cachedHrefUserClicked = "";

        function InitializePlugin()
        {
            session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
                {
                    m_callFunction = callFunction;
                    activatePlugin(m_pluginId, OnPing);
                });
            browsersApi.runtime.onMessage.addListener(OnMessage);
            browsersApi.webNavigation.onCommitted.addListener(OnCommittedHandler);
            const filter = { urls: ["https://*/*", "http://*/*"] };
            browsersApi.webRequest.onBeforeRedirect.addListener(OnBeforeRedirectHandler, filter, []);
            browsersApi.tabs.onRemoved.addListener(OnRemovedHandler);
        }

        function CallActiveTab(resolve)
        {
            return report =>
            {
                ApiCall(browsersApi.tabs.query)
                    .OnSuccess(result =>
                        {
                            if (result.length === 0)
                            {
                                ns.SessionLog("Not found active tab for current window");
                                return;
                            }
                            ns.SessionLog(`Found active tab with id ${result[0].id} and url ${result[0].url}`);
                            report.tabId = result[0].id;
                            report.url = result[0].url;
                            resolve(report);
                        })
                    .OnError(err => ns.SessionError(err, m_pluginId))
                    .Start({ active: true, windowType: "normal", currentWindow: true });
            };
        }

        function OnPing()
        {
            return ns.MaxRequestDelay;
        }

        function AddDocumentHTMLtoReport(resolve)
        {
            return report =>
            {
                ApiCall(browsersApi.tabs.executeScript)
                    .OnSuccess(executeResults =>
                        {
                            report.webpage = "";
                            if (typeof executeResults[0] === "undefined")
                            {
                                ns.SessionLog("AddDocumentHTMLtoReport: result not found");
                            }
                            else
                            {
                                ns.SessionLog("Inner html received");
                                report.webpage = executeResults[0].result;
                            }
                            resolve(report);
                        })
                    .OnError(err => ns.SessionLog(`AddDocumentHTMLtoReport failed with error ${err.message}`))
                    .Start({
                        target: { tabId: report.tabId },
                        func: () => { return document.documentElement.innerHTML; }
                    });
            };
        }

        function AddRedirectsToReport(resolve)
        {
            return report =>
            {
                report.redirects = [];
                if (m_redirects.has(report.tabId) && m_redirects.get(report.tabId).length > 1)
                    report.redirects = m_redirects.get(report.tabId);
                resolve(report);
            };
        }

        function OnCommittedHandler(details)
        {
            try
            {
                CheckLastError();

                if (details.frameId !== 0)
                    return;

                const id = details.tabId;
                const url = details.url;

                let isNeedRemovePrevRedirects = userTransitionTypesToClearRedirects.has(details.transitionType);
                if (details.transitionType === "link")
                {
                    for (let i = 0; i < details.transitionQualifiers.length; i++)
                    {
                        if (userTransitionQualifiersToClearRedirects.has(details.transitionQualifiers[i]))
                        {
                            isNeedRemovePrevRedirects = true;
                            break;
                        }
                    }
                    if (!isNeedRemovePrevRedirects && m_cachedHrefUserClicked.length > 0)
                    {
                        isNeedRemovePrevRedirects = m_cachedHrefUserClicked === details.url.replace(/#.*/, "");
                        if (isNeedRemovePrevRedirects)
                            m_cachedHrefUserClicked = "";
                    }
                }
                if (isNeedRemovePrevRedirects || !m_redirects.has(id))
                    m_redirects.set(id, []);

                if (m_beforeRedirectMap.has(id))
                {
                    const redirects = m_beforeRedirectMap.get(id);
                    for (let i = 0; i < redirects.length; i++)
                        m_redirects.get(id).push(redirects[i]);
                    m_beforeRedirectMap.set(id, []);
                }
                m_redirects.get(id).push(url);
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function OnBeforeRedirectHandler(details)
        {
            try
            {
                CheckLastError();

                if (details.frameId !== 0 || details.type !== "main_frame")
                    return;
                const id = details.tabId;
                const url = details.url;

                if (!m_beforeRedirectMap.has(id))
                    m_beforeRedirectMap.set(id, [url]);
                else
                    m_beforeRedirectMap.get(id).push(url);
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function OnRemovedHandler(tabId)
        {
            try
            {
                CheckLastError();

                if (m_redirects.has(tabId))
                    m_redirects.delete(tabId);

                if (m_beforeRedirectMap.has(tabId))
                    m_beforeRedirectMap.delete(tabId);
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function OpenBwfbWindow(request)
        {
            return report => { request.report = report; m_bwfbWindow.Open(request); };
        }

        function OpenPhfbWindow(request)
        {
            return report => { request.report = report; m_phfbWindow.Open(request); };
        }

        function OnMessage(request)
        {
            try
            {
                CheckLastError();

                if (request.command === "bwfb.openWindow")
                {
                    if (m_bwfbWindow.IsOpened())
                        return;

                    ns.SessionLog("Broken webpage call open window");
                    const report = {};
                    CallActiveTab(
                        AddDocumentHTMLtoReport(
                            OpenBwfbWindow(request)
                        )
                    )(report);
                }
                else if (request.command === "phfb.openWindow")
                {
                    if (m_phfbWindow.IsOpened())
                        return;

                    ns.SessionLog("User feedback call open window");
                    const report = {};
                    CallActiveTab(
                        AddDocumentHTMLtoReport(
                            AddRedirectsToReport(
                                OpenPhfbWindow(request)
                            )
                        )
                    )(report);
                }
                else if (request.command === "ufb.sendReport")
                {
                    if (request.report.type === "ufb.phishing")
                        SendPhishingReport(request.report);
                    else if (request.report.type === "ufb.broken_webpage")
                        SendBrokenWebpageReport(request.report);
                }
                else if (request.command === "ufb.openPhishingInfo")
                {
                    OpenPhishingInfo();
                }
                else if (request.command === "ufb.cacheUserClick")
                {
                    m_cachedHrefUserClicked = request.url;
                }
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function SendPhishingReport(report)
        {
            m_callFunction("phfb_popup.send_report", { url: report.url, webpage: report.webpage, redirects: report.redirects });
        }

        function SendBrokenWebpageReport(report)
        {
            m_callFunction("bwfb_popup.send_report", { url: report.url, webpage: report.webpage, userText: report.userText });
        }

        function OpenPhishingInfo()
        {
            m_callFunction("phfb_popup.open_info");
        }

        this.Stop = () =>
        {
            m_phfbWindow.Close();
            m_bwfbWindow.Close();
        };

        InitializePlugin();
    }

    instance = new UserFeedbackBackgroundImpl();
}

function StopImpl()
{
    if (instance)
        instance.Stop();
}

AvNs.AddRunner2({
    name: "ufb",
    runner: RunnerImpl,
    stop: StopImpl
});
})();
