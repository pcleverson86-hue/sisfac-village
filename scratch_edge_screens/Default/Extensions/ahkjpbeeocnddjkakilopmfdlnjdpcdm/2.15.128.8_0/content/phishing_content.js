AvNs.AddRunner("phfb_content", ns =>
{
    function PhishingFeedbackContent()
    {
        function InitializePlugin()
        {
            ns.AddEventListener(document, "click", function onClick(event)
            {
                if (!ns.IsValidTargetProperty(event) || !event.target.closest)
                    return;
                const element = event.target.closest("a[href]");
                if (element !== null && typeof element.href === "string")
                {
                    ApiCall(browsersApi.runtime.sendMessage)
                        .OnError(err => ns.SessionLog(`Failed ufb.cacheUserClick with error ${err.message}`))
                        .Start({ command: "ufb.cacheUserClick", url: element.href.replace(/#.*/, "") });
                }
            }, "phfb_content");
        }
        InitializePlugin();
    }

    let instance = null;
    ns.RunModule(() =>
    {
        if (!instance)
            instance = new PhishingFeedbackContent();
    });
});
