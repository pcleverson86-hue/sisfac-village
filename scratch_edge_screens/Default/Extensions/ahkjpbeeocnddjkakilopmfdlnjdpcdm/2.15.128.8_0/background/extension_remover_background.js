AvNs.AddRunner("erb", (ns, session, settings) =>
{
    let m_callFunction = () => {};
    const m_interestingDomain = (settings && settings.startDomain) ? `http://${settings.startDomain}` : "http://touch.kaspersky.com";

    function Initialize()
    {
        session.InitializePlugin((activatePlugin, registerMethod, callFunction) => { m_callFunction = callFunction; });
        browsersApi.tabs.onCreated.addListener(OnCreatedTab);
        browsersApi.tabs.onUpdated.addListener(OnUpdatedTab);
        ApiCall(browsersApi.tabs.query)
            .OnSuccess(ProcessExistTabs)
            .OnError(err => ns.SessionLog(`Query tabs failed with error ${err.message}`))
            .Start({ url: `${m_interestingDomain}/*` });
    }

    function GetRemoverHtmlBase()
    {
        return browsersApi.runtime.getURL("additional/extension_remover.html?id=");
    }

    function OnCreatedTab(tab)
    {
        if (chrome.runtime.lastError)
        {
            ns.SessionLog(`Error occured on remover OnCreatedTab: ${chrome.runtime.lastError.message}`);
            return;
        }
        ProcessTabSafe(tab);
    }

    function OnUpdatedTab(tabId, changeInfo, tab)
    {
        if (chrome.runtime.lastError)
        {
            ns.SessionLog(`Error occured on remover OnUpdatedTab: ${chrome.runtime.lastError.message}`);
            return;
        }
        if (changeInfo.url)
            ProcessTabSafe(tab);
    }

    function ProcessExistTabs(tabs)
    {
        if (!tabs)
            return;

        for (const tab of tabs)
            ProcessTabSafe(tab);
    }

    function ProcessRedirectResponse(tab, res, args)
    {
        if (res === 0)
        {
            ApiCall(browsersApi.tabs.update)
                .OnError(err => ns.SessionError(err, "erb"))
                .Start(tab.tabId, { url: `${GetRemoverHtmlBase()}${args.id}` });
        }
    }

    function GetHttpUrl(tab)
    {
        return tab.url.replace("https://", "http://");
    }

    function RequestRedirectTarget(tab)
    {
        m_callFunction("erb.requestRedirect", { url: GetHttpUrl(tab) }, (res, args) => { ProcessRedirectResponse(tab, res, args); });
    }

    function ProcessTabSafe(tab)
    {
        try
        {
            if (!tab.url)
                return;

            if (GetHttpUrl(tab).indexOf(m_interestingDomain) === 0)
            {
                RequestRedirectTarget(tab);
                ns.SessionLog(`Found internal url: ${tab.url}`);
            }
        }
        catch (e)
        {
            ns.SessionLog(e);
        }
    }

    Initialize();
});
