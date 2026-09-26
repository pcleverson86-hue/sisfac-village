(function BrowserCookie()
{

let m_callFunction = AvNs.EmptyFunc;
let m_deactivateFunction = AvNs.EmptyFunc;

function RunnerImpl(ns, session)
{
const m_optionalCookieFields = ["value", "domain", "path", "secure", "httpOnly", "expirationDate"];

function onPing()
{
    return ns.MaxRequestDelay;
}

function ConvertTimeUnixToWindows(unixTime)
{
    const diff = 116444736000000000;
    return (unixTime * 10000000) + diff;
}

function ConvertTimeWindowsToUnix(winTime)
{
    const diff = 11644473600;
    return (winTime / 10000000) - diff;
}

function callToService(commandPostfix, jsonArg)
{
    m_callFunction(`cm.${commandPostfix}`, jsonArg);
}

function OnGetCookieCall(getCookieDetails)
{
    ApiCall(browsersApi.cookies.getAll)
        .OnSuccess(cookies => OnGetCookieCallback(getCookieDetails.callId, cookies))
        .OnError(err =>
            {
                callToService("getCallback", { callId: getCookieDetails.callId, isSucceeded: false });
                ns.SessionError({ message: "Get cookie error occure", details: `error: ${err.message}` }, "cm");
            })
        .Start({ url: getCookieDetails.url });
}

function OnSetCookieCall(setCookieDetails)
{
    if (setCookieDetails.cookies.length === 0)
    {
        ns.SessionError("Wrong cookies list (empty)", "cm");
        return;
    }
    SetCookieImpl(setCookieDetails.callId, setCookieDetails.url, setCookieDetails.cookies.shift(), setCookieDetails.cookies, "");
}

function OnGetCookieCallback(callId, cookies)
{
    const cookiesArg = [];
    for (let i = 0; i < cookies.length; ++i)
    {
        const cookie = cookies[i];
        const cookieArg = { name: cookie.name, value: cookie.value };
        for (let j = 0; j < m_optionalCookieFields.length; ++j)
        {
            const cookieField = m_optionalCookieFields[j];
            if (ns.IsDefined(cookie[cookieField]))
            {
                cookieArg[`${cookieField}_initialized`] = true;
                cookieArg[cookieField] = cookie[cookieField];
            }
        }
        if (ns.IsDefined(cookieArg.expirationDate))
            cookieArg.expirationDate = ConvertTimeUnixToWindows(cookieArg.expirationDate);

        cookiesArg.push(cookieArg);
    }
    callToService("getCallback", { callId: callId, isSucceeded: true, cookies: cookiesArg });
}

function OnSetCookieCallback(callId, url, tail, errors, settedCookie, err)
{
    let newErrors = errors;
    if (!settedCookie && err)
        newErrors += `${err.message};`;

    if (!tail.length)
    {
        callToService("setCallback", { callId: callId, isSucceeded: !newErrors && Boolean(settedCookie) });
        return;
    }

    const cookie = tail.shift();
    SetCookieImpl(callId, url, cookie, tail, newErrors);
}

function SetCookieImpl(callId, url, cookie, tail, errors)
{
    const cookieArg = { url: url, name: cookie.name };
    for (let i = 0; i < m_optionalCookieFields.length; ++i)
    {
        const cookieField = m_optionalCookieFields[i];
        if (cookie[`${cookieField}_initialized`])
            cookieArg[cookieField] = cookie[cookieField];
    }
    if (ns.IsDefined(cookieArg.expirationDate))
        cookieArg.expirationDate = ConvertTimeWindowsToUnix(cookieArg.expirationDate);

    ApiCall(browsersApi.cookies.set)
        .OnSuccess(settedCookie => OnSetCookieCallback(callId, url, tail, errors, settedCookie, null))
        .OnError(err => OnSetCookieCallback(callId, url, tail, errors, null, err))
        .Start(cookieArg);
}

function onPluginInitialized(activatePlugin, registerMethod, callFunction, deactivateFunction)
{
    m_callFunction = callFunction;
    m_deactivateFunction = deactivateFunction;

    activatePlugin("cm", onPing);
    registerMethod("cm.getCookie", OnGetCookieCall);
    registerMethod("cm.setCookie", OnSetCookieCall);
}

session.InitializePlugin(onPluginInitialized);
}

function StopImpl()
{
    m_deactivateFunction("cm");
}

AvNs.AddRunner2({
    name: "cm",
    runner: RunnerImpl,
    stop: StopImpl
});
})();
