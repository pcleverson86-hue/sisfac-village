AvNs.AddRunner("dpbgrd", ns =>
{
    function HistoryStateUpdate(details)
    {
        try
        {
            CheckLastError();

            if (details.frameId !== 0)
                return;
            ApiCall(browsersApi.tabs.sendMessage)
                .OnError(err => ns.SessionLog(`HistoryStateUpdate failed with error ${err.message}`))
                .Start(details.tabId, { command: "HistoryStateUpdate" }, { frameId: 0 });
        }
        catch (e)
        {
            ns.SessionError(e, "dpbgrd");
        }
    }

    browsersApi.webNavigation.onHistoryStateUpdated.addListener(HistoryStateUpdate);
});
