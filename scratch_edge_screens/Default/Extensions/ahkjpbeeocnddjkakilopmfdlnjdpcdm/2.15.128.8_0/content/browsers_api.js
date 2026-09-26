
const browsersApi = {
    cookies: chrome.cookies,
    extension: {
        getURL: chrome.runtime.getURL
    },
    i18n: chrome.i18n,
    management: chrome.management,
    tabs: chrome.tabs,
    windows: chrome.windows,
    runtime: chrome.runtime
};

browsersApi.getVersion = function getVersion()
{
        const browserVersion = /Chrome\/(\d*)./;
        const matched = browserVersion.exec(navigator.userAgent);
        if (matched)
            return Number(matched[1]);
        return -1;
};

function IsBrowserShuttingDown(err)
{
    return err.message === "The browser is shutting down.";
}

const ApiCallType = Object.freeze({
    WITH_PROMISE: Symbol("with_promise"),
    WITH_CALLBACK: Symbol("with_callback"),
    DETACHED: Symbol("detached")
});
function ApiCall(fn, type = ApiCallType.WITH_PROMISE)
{
    let m_onSuccess = null;
    let m_onError = null;

    function getType()
    {
        if (fn === browsersApi.runtime.sendMessage)
        {
            const ver = browsersApi.getVersion();
            if (ver > 0 && ver < 100)
                return ApiCallType.WITH_CALLBACK;
        }
        return type;
    }

    this.OnError = onError =>
    {
        m_onError = onError;
        return this;
    };

    this.OnSuccess = onSuccess =>
    {
        m_onSuccess = onSuccess;
        return this;
    };

    function CallWithCallback(...args)
    {
        fn(...args, (...resultArgs) =>
            {
                if (browsersApi.runtime.lastError)
                {
                    if (!IsBrowserShuttingDown(browsersApi.runtime.lastError))
                        m_onError && m_onError(browsersApi.runtime.lastError);
                    return;
                }
                try
                {
                    m_onSuccess && m_onSuccess(...resultArgs);
                }
                catch (err)
                {
                    m_onError && m_onError(err);
                }
            });
    }

    this.Start = (...args) =>
    {
        switch (getType())
        {
            case ApiCallType.WITH_PROMISE:
                {
                    const apiCall = fn(...args);
                    if (apiCall)
                    {
                        apiCall.then((...resultArgs) => m_onSuccess && m_onSuccess(...resultArgs))
                        .catch(err =>
                            {
                                if (!IsBrowserShuttingDown(err))
                                    m_onError && m_onError(err);
                            });
                    }
                    break;
                }
            case ApiCallType.WITH_CALLBACK:
                {
                    CallWithCallback(...args);
                    break;
                }
            case ApiCallType.DETACHED:
                {
                    fn(...args);
                    break;
                }
            default:
                break;
        }
    };

    return this;
}
