AvNs.AddRunner("xhr_tracker", (ns, session, settings) =>
{
    let m_callFunction = null;
    const m_pluginId = "xhr_tracker";

    function IsHeader(headers, name, value)
    {
        return ns.IsDefined(
            headers.find(element => ns.IsStringEqualIgnoreCase(element["name"], name)
                && (value ? ns.IsStringEqualIgnoreCase(element["value"], value) : true))
        );
    }

    function GetCustomHeader()
    {
        return settings.customHeader || "X-KL-Ajax-Request";
    }

    function Initialize()
    {
        session.InitializePlugin((activatePlugin, registerMethod, callFunction) =>
        {
            m_callFunction = callFunction;
            activatePlugin(m_pluginId, OnPing);

            browsersApi.webRequest.onBeforeSendHeaders.addListener(
                OnBeforeSendHeaders,
                { urls: ["<all_urls>"] },
                ["requestHeaders"]
            );
        });
    }

    function OnBeforeSendHeaders(details)
    {
        try
        {
            CheckLastError();

            if (details.type !== "xmlhttprequest")
                return;

            const origin = details.originUrl || details.initiator;
            if (ns.IsCorsRequest(details.url, origin) || !IsHeader(details.requestHeaders, GetCustomHeader()))
                m_callFunction("xhr.onBeforeSendHeaders", { url: details.url });
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    Initialize();
});
