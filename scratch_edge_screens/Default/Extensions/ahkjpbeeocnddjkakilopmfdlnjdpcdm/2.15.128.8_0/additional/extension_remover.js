
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
 var AvNs = (function IeJsonMain(context) 
{
    context["JSONStringify"] = JSON.stringify;
    context["JSONParse"] = JSON.parse;
    return context;
})(AvNs || {});

(function CommonMain(ns)
{
    ns.XMLHttpRequest = window.XMLHttpRequest;
    ns.XDomainRequest = window.XDomainRequest;
    ns.XMLHttpRequestOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
    ns.XMLHttpRequestSend = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
    ns.XMLHttpRequestAbort = window.XMLHttpRequest && window.XMLHttpRequest.prototype.abort;
    ns.XMLHttpRequestSetRequestHeader = window.XMLHttpRequest && window.XMLHttpRequest.prototype.setRequestHeader;

    var originalCreateTreeWalker = document.createTreeWalker;
    ns.CreateTreeWalker = function CreateTreeWalker(root, whatToShow, filter, entityReferenceExpansion)
    {   
        if (typeof (originalCreateTreeWalker) !== "function")
            throw new Error("document.createTreeWalker not implemented");

        return originalCreateTreeWalker.call(document, root, whatToShow, filter, entityReferenceExpansion);
    };


    ns.ObjectHasOwnProperty = Object.prototype.hasOwnProperty;
    ns.ElementSetAttribute = Element.prototype.setAttribute;
    ns.ElementAttachShadow = Element.prototype.attachShadow;
    ns.documentCreateTextNode = document.createTextNode;
    ns.documentStyleSheets = document.styleSheets;
    ns.StringSplit = String.prototype.split;
    ns.StringReplace = String.prototype.replace;
    ns.StringFromCharCode = String.fromCharCode;

    ns.EmptyFunc = function EmptyFunc()
    {
    };

    ns.IsStringEqualIgnoreCase = function IsStringEqualIgnoreCase(left, right)
    {
        if (typeof left !== "string" || typeof right !== "string")
            return false;
        return left.toLowerCase() === right.toLowerCase();
    };

    ns.MaxRequestDelay = 2000;

    ns.Log = ns.EmptyFunc;

    ns.SessionLog = ns.Log;

    ns.SessionError = ns.Log;

    function GetHostAndPort(url)
    {
        if (!url)
            return "";

        var urlString = typeof url !== "string" ? url.toString() : url;
        var hostBeginPos = urlString.indexOf("//");
        if (hostBeginPos === -1)
        {
            urlString = document.baseURI || "";
            hostBeginPos = urlString.indexOf("//");
            if (hostBeginPos === -1)
                return "";
        }
        hostBeginPos += 2;
        var hostEndPos = urlString.indexOf("/", hostBeginPos);
        if (hostEndPos === -1)
            hostEndPos = urlString.length;
        var originParts = ns.StringSplit.call(urlString.substring(0, hostEndPos), "@");
        var origin = originParts.length > 1 ? originParts[1] : originParts[0];
        return origin[0] === "/" ? document.location.protocol + origin : origin;
    }

    ns.IsCorsRequest = function IsCorsRequest(url, initiator)
    {
        try
        {
            var urlOrigin = GetHostAndPort(url);
            var initiatorOrigin = GetHostAndPort(initiator);

            return Boolean(urlOrigin) && Boolean(initiatorOrigin) && urlOrigin !== initiatorOrigin;
        }
        catch (e)
        {
            ns.SessionLog("Error check CORS request, url: " + url + " , initiator: " + initiator + ", error: " + e.message);
            return false;
        }
    };

    ns.TryCreateUrl = function TryCreateUrl(url)
    {
        try
        {
            var replacedUrl = ns.StringReplace.call(url, /(https?:\/\/)\.(?=[0-9xa-fA-F])/i, "$1"); 
            return new URL(replacedUrl);
        }
        catch (e)
        {
            ns.SessionLog("Can't create URL from " + url);
            return null;
        }
    };

    ns.TrySendMessage = function TrySendMessage(port, message)
    {
        try
        {
            port.postMessage(message);
        }
        catch (e)
        {
            if (e.message && e.message.startsWith("Attempt to postMessage on disconnected port"))
                ns.SessionLog("Attempt to postMessage on disconnected port: " + JSON.stringify(message));
            else
                ns.SessionError(e, "nms_back");
        }
    };

    ns.HasValue = function HasValue(value)
    {
        return value && value.length !== 0;
    };

    ns.GetResourceSrc = function GetResourceSrc(resourceName)
    {
        return ns.GetBaseUrl() + ns.RESOURCE_ID + resourceName;
    };

    ns.IsRelativeTransport = function IsRelativeTransport()
    {
        return ns.PREFIX === "/";
    };

    ns.GetBaseUrl = function GetBaseUrl()
    {
        if (!ns.IsRelativeTransport())
            return ns.PREFIX;
        return document.location.protocol + "//" + document.location.host + "/";
    };

    ns.AppendChild = function AppendChild(element, addElement)
    {
        return element.appendChild(addElement);
    };

    ns.AddEventListener = function AddEventListener(element, name, func, pluginId)
    {
        element.addEventListener(name,
            e =>
            {
                try
                {
                    func(e || window.event);
                }
                catch (ex)
                {
                    ns.SessionError(ex, pluginId);
                }
            }, 
            true);
    };

    ns.AddRemovableEventListener = function AddRemovableEventListener(element, name, func)
    {
        element.addEventListener(name, func, true);
    };

    ns.RemoveElement = function RemoveElement(element)
    {
        element && element.parentNode && element.parentNode.removeChild(element);
    };

    var originalDocumentCreateElement = document.createElement;
    ns.DocumentCreateElement = function DocumentCreateElement(elementType)
    {
        return originalDocumentCreateElement.call(document, elementType);
    };

    var originalDocumentQuerySelectorAll = document.querySelectorAll;
    ns.HasDocumentQuerySelectorAll = function HasDocumentQuerySelectorAll()
    {
        return Boolean(originalDocumentQuerySelectorAll);
    };

    ns.DocumentQuerySelectorAll = function DocumentQuerySelectorAll(selector)
    {
        return originalDocumentQuerySelectorAll.call(document, selector);
    };

    var originalElementQuerySelectorAll = Element.prototype.querySelectorAll;
    ns.HasElementQuerySelectorAll = function HasElementQuerySelectorAll()
    {
        return Boolean(originalElementQuerySelectorAll);
    };

    ns.ElementQuerySelectorAll = function ElementQuerySelectorAll(element, selector)
    {
        return originalElementQuerySelectorAll.call(element, selector);
    };

    ns.RunModule = function RunModule(func, timeout)
    {
        if (document.readyState === "loading")
        {
            if (timeout)
                ns.SetTimeout(func, timeout);

            var delayFunc = function DelayFunc() { ns.SetTimeout(func, 0); };

            if (document.addEventListener)
                ns.AddEventListener(document, "DOMContentLoaded", delayFunc);

            ns.AddEventListener(window, "load", delayFunc);
        }
        else
        {
            ns.SetTimeout(func, 0); 
        }
    };

    ns.RemoveEventListener = function RemoveEventListener(element,  name, func)
    {
        if (element.removeEventListener)
            element.removeEventListener(name, func, true);
        else
            element.detachEvent("on" + name, func);
    };

    var oldSetTimeout = setTimeout;
    var oldClearTimeout = clearTimeout;
    ns.SetTimeout = function SetTimeout(func, timeout, pluginId)
    {
        return oldSetTimeout.call(window, function TimerCallback()
            {
                try
                {
                    func();
                }
                catch (e)
                {
                    ns.SessionError(e, pluginId);
                }
            }, timeout);
    };

    ns.ClearTimeout = function ClearTimeout(id)
    {
        oldClearTimeout.call(window, id);
    };

    var oldSetInterval = setInterval;
    var oldClearInterval = clearInterval;
    ns.SetInterval = function SetInterval(func, interval, pluginId)
    {
        return oldSetInterval.call(window, function IntervalCallback()
            {
                try
                {
                    func();
                }
                catch (e)
                {
                    ns.SessionError(e, pluginId);
                }
            }, interval);
    };
    ns.ClearInterval = function ClearInterval(id)
    {
        return oldClearInterval.call(window, id);
    };

    ns.GetOwnerNode = function GetOwnerNode(element)
    {
        return element.ownerNode || element.owningElement;
    };

    function InsertStyleRule(style, rule)
    {
        try
        {
            if (style.styleSheet)
            {
                style.styleSheet.cssText += rule + "\n";
            }
            else
            {
                ns.AppendChild(style, ns.documentCreateTextNode.call(document, rule));
                ns.SetTimeout(function TimerCallback()
                    {
                        if (!style.sheet)
                            return;
                        var rules = style.sheet.cssRules || style.sheet.rules;
                        if (rules && rules.length === 0)
                            style.sheet.insertRule(rule);
                    }, 500);
            }
        }
        catch (e)
        {
            if (e.message === "can't access dead object")
                ns.SessionLog("Trying to set css for dead object");
            else
                throw e;
        }
    }

    function FindStyle(document, style)
    {
        for (var i = 0; i < ns.documentStyleSheets.length; ++i)
        {
            var ownerNode = ns.GetOwnerNode(ns.documentStyleSheets[i]);
            if (ownerNode && ownerNode.className === "abn_style" && ownerNode.textContent === style.textContent)
                return ownerNode;
        }
        return null;
    }

    function GetHead()
    {
        var headElements = document.getElementsByTagName("head");
        return headElements.length !== 0 ? headElements[0] : null;
    }

    function AddDocumentStyles(document, rules)
    {
        if (typeof rules !== "object" || rules.constructor !== Array)
            return [];

        var styles = [];
        for (var i = 0, len = rules.length; i < len;)
        {
            var style = ns.DocumentCreateElement("style");
            style.type = "text/css";
            style.className = "abn_style";
            style.setAttribute("nonce", ns.ContentSecurityPolicyNonceAttribute);

            for (var n = 0; n < 4 && i < len; ++n, ++i)
            {
                var rule = rules[i];
                if (originalDocumentQuerySelectorAll)
                {
                    InsertStyleRule(style, rule);
                }
                else
                {
                    var styleBegin = rule.lastIndexOf("{");
                    if (styleBegin === -1)
                        continue;

                    var styleText = rule.substr(styleBegin);
                    var selectors = ns.StringSplit.call(rule.substr(0, styleBegin), ",");
                    if (style.styleSheet)
                    {
                        var cssText = "";
                        for (var j = 0; j !== selectors.length; ++j)
                            cssText += selectors[j] + styleText + "\n";

                        style.styleSheet.cssText += cssText;
                    }
                    else
                    {
                        for (var k = 0; k !== selectors.length; ++k)
                            ns.AppendChild(style, ns.documentCreateTextNode.call(document, selectors[k] + styleText));
                    }
                }
            }

            var inserted = FindStyle(document, style);
            if (inserted && inserted.parentNode)
                inserted.parentNode.removeChild(inserted);

            if (document.head && typeof document.head.appendChild === "function")
            {
                ns.AppendChild(document.head, style);
            }
            else
            {
                var head = GetHead();
                if (head)
                {
                    ns.AppendChild(head, style);
                }
                else
                {
                    ns.AddEventListener(document, "load", function AddStyle()
                    {
                        var element = document.head || GetHead();
                        if (!element)
                            return;
                        for (var l = 0; l !== styles.length; ++l)
                            ns.AppendChild(element, styles[l]);
                    });
                }
            }

            styles.push(style);
        }

        return styles;
    }

    ns.AddStyles = function AddStyles(rules)
    {
        return AddDocumentStyles(document, rules);
    };

    var originalDate = Date;
    var originalGetTime = Date.prototype.getTime;
    var originalToIsoString = Date.prototype.toISOString;

    ns.GetCurrentIsoDate = function GetCurrentIsoDate()
    {
        return originalToIsoString.call(new originalDate());
    };

    ns.GetCurrentTime = function GetCurrentTime()
    {
        try
        {
            var date = new originalDate();
            if (date && originalGetTime)
                return originalGetTime.call(date);
            throw new Error("Cannot call getTime for date: " + date);
        }
        catch (e)
        {
            ns.SessionError(e);
            return 0;
        }
    };

    ns.GetPageScroll = function GetPageScroll()
    {
        var documentScrollLeft = 0;
        var documentScrollTop = 0;
        if (document.documentElement)
        {
            documentScrollLeft = document.documentElement.scrollLeft;
            documentScrollTop = document.documentElement.scrollTop;
        }
        var bodyScrollLeft = 0;
        var bodyScrollTop = 0;
        if (document.body)
        {
            bodyScrollLeft = document.body.scrollLeft;
            bodyScrollTop = document.body.scrollTop;
        }
        return { left: documentScrollLeft || bodyScrollLeft || 0, top: documentScrollTop || bodyScrollTop || 0 };
    };

    ns.GetPageHeight = function GetPageHeight()
    {
        return document.documentElement.clientHeight || document.body.clientHeight;
    };

    ns.GetPageWidth = function GetPageWidth()
    {
        return document.documentElement.clientWidth || document.body.clientWidth;
    };

    ns.IsDefined = function IsDefined(variable)
    {
        return typeof variable !== "undefined";
    };

    ns.StopProcessingEvent = function StopProcessingEvent(evt)
    {
        if (evt.preventDefault)
            evt.preventDefault();
        else
            evt.returnValue = false;
        if (evt.stopPropagation)
            evt.stopPropagation();
        if (ns.IsDefined(evt.cancelBubble))
            evt.cancelBubble = true;
    };

    var originalBtoa = window.btoa;

    function Base64EncodeUnicode(str)
    {
        return originalBtoa.call(window, ns.StringReplace.call(encodeURIComponent(str), /%([0-9A-F]{2})/g, function toSolidBytes(match, p1)
            {
                return ns.StringFromCharCode("0x" + p1);
            }));
    }

    ns.ToBase64 = function ToBase64(value)
    {
        try
        {
            return Base64EncodeUnicode(value);
        }
        catch (e)
        {
            ns.SessionError("Cannot convert to Base64: " + e.message, "common");
        }
        return "";
    };

    ns.IsSenderPopup = sender => sender.id === browsersApi.runtime.id && sender.url === browsersApi.runtime.getURL("popup/popup.html");

    ns.TrySendResponse = (sendResponse, responseObject) =>
    {
        try
        {
            sendResponse(responseObject);
        }
        catch (e)
        {
            AvNs.Log("Response was not sent, sender page was closed or redirected: ", e);
        }
    };

    ns.BrowserName = "chrome";

    ns.EncodeTabId = (windowId, tabId, frameId) => `${AvNs.BrowserName}.tab.${windowId}:${tabId}.${frameId}`;

    ns.SplitTabId = encodedTabId =>
    {
        const result = encodedTabId.match(/(\w*).tab.(\d*):(\d*).(\d*)/);
        const browser = result[1];
        const windowId = parseInt(result[2], 10);
        const tabId = parseInt(result[3], 10);
        const frameId = parseInt(result[4], 10);
        return { browser: browser, windowId: windowId, tabId: tabId, frameId: frameId };
    };

    ns.ValidateTabId = encodedTabId =>
    {
        try
        {
            const parts = ns.SplitTabId(encodedTabId);
            return parts.browser === AvNs.BrowserName;
        }
        catch (e)
        {
            ns.SessionLog(e);
            return false;
        }
    };

    ns.FindElement = function FindElement(tag, type)
    {
        const result = document.querySelector(`${tag}[type='${type}']`);
        if (result)
            return result;

        const elementsByTag = document.getElementsByTagName(tag);
        for (const element of elementsByTag)
        {
            if (element.type.toLowerCase() === type)
                return element;
        }
        return null;
    };


    ns.StartLocationHref = document.location.href;
    ns.IsTopLevel = window && window === window.top;

    ns.IsElementVisibleCheckApplicable = function IsElementVisibleCheckApplicable()
    {
        return window && window.getComputedStyle;
    };

    ns.IsElementVisible = function IsElementVisible(element)
    {
        return window.getComputedStyle(element).visibility === "visible";
    };

    var originalElement = Element;
    ns.IsElementDisplayed = function IsElementDisplayed(element)
    {
        var style = (ns.IsElementVisibleCheckApplicable() && originalElement && element instanceof originalElement) ? window.getComputedStyle(element) : element.currentStyle;
        if (!style)
            return false;
        return style.display !== "none";
    };

    ns.DisableElementById = function DisableElementById(id)
    {
        const el = document.getElementById(id);
        if (el)
            el.classList.add("disabled");
    };

    ns.GetPageStartTime = function GetPageStartTime()
    {
        return window && window.performance && window.performance.timing && window.performance.timing.domContentLoadedEventStart
            ? window.performance.timing.domContentLoadedEventStart
            : 0;
    };

    ns.GetPageStartNavigationTime = function GetPageStartNavigationTime()
    {
        return window && window.performance && window.performance.timing && window.performance.timing.navigationStart
            ? window.performance.timing.navigationStart
            : 0;
    };

    ns.TryGetTagName = function TryGetTagName(element)
    {
        try
        {
            return element.tagName;
        }
        catch (e)
        {
            return "";
        }
    };

    ns.IsValidTargetProperty = function IsValidTargetProperty(event)
    {
        try
        {
            return event && event.target;
        }
        catch (e)
        {
            ns.SessionLog(e);
            return false;
        }
    };

    ns.IsEqualNodeName = function IsEqualNodeName(element, nodeName)
    {
        try
        {
            if (!element)
                return false;
            return ns.IsStringEqualIgnoreCase(element.nodeName, nodeName);
        }
        catch (e)
        {
            ns.SessionLog(e);
            return false;
        }
    };

    ns.SubscribeHistoryChanged = ns.EmptyFunc;
    ns.UnsubscribeHistoryChanged = ns.EmptyFunc;
    ns.WindowHistoryPushState = function PushStateExecutor()
    {
        window.history.pushState(...arguments);
    };

    return ns;
})(AvNs);

(function CommonMutation(ns)
{
    function IsElementNode(node)
    {
        return node.nodeType === 1; 
    }

    function IsNodeContainsElementWithTag(node, observeTag)
    {
        try
        {
            return observeTag === "*" || (IsElementNode(node) && (ns.IsStringEqualIgnoreCase(node.tagName, observeTag) || node.getElementsByTagName(observeTag).length > 0));
        }
        catch (e)
        {
            return false;
        }
    }

    function MutationChangeObserver(observeTag, pluginId)
    {
        var m_observer = null;
        var m_callback = null;
        var m_functionCheckInteresting = observeTag ? function functionCheckInteresting(node) { return IsNodeContainsElementWithTag(node, observeTag); } : IsElementNode;

        function ProcessNodeList(nodeList)
        {
            for (var i = 0; i < nodeList.length; ++i)
            {
                if (m_functionCheckInteresting(nodeList[i]))
                    return true;
            }
            return false;
        }

        function ProcessDomChange(records)
        {
            try
            {
                if (!m_callback)
                    return;

                for (var i = 0; i < records.length; ++i)
                {
                    var record = records[i];
                    if ((record.addedNodes.length && ProcessNodeList(record.addedNodes))
                        || (record.removedNodes.length && ProcessNodeList(record.removedNodes)))
                    {
                        m_callback();
                        return;
                    }
                }
            }
            catch (e)
            {
                ns.SessionError(e, pluginId);
            }
        }

        this.Start = function Start(callback)
        {
            m_callback = callback;
            m_observer = new MutationObserver(ProcessDomChange);
            m_observer.observe(document, { childList: true, subtree: true });
        };
        this.Stop = function Stop()
        {
            if (m_observer)
                m_observer.disconnect();
            m_observer = null;
            m_callback = null;
        };
    }

    ns.GetDomChangeObserver = function GetDomChangeObserver(observeTag, pluginId)
    {
        var observeTagLowerCase = observeTag ? observeTag.toLowerCase() : observeTag;
        return new MutationChangeObserver(observeTagLowerCase, pluginId);
    };

    return ns;
})(AvNs);
(function Md5Main(ns)
{

    function repeatElem(e, t)
    {
        var r = [];
        for (var i = 0; i < t; i++)
            r = r.concat(e);
        return r;
    }
    var S = repeatElem([7, 12, 17, 22], 4);
    S = S.concat(repeatElem([5, 9, 14, 20], 4));
    S = S.concat(repeatElem([4, 11, 16, 23], 4));
    S = S.concat(repeatElem([6, 10, 15, 21], 4));

    var K = [
              0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
              0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
              0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
              0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
              0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
              0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
              0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
              0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
              0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
              0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
              0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
              0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
              0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
              0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
              0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
              0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
        ];

    var A0 = 0x67452301;
    var B0 = 0xefcdab89;
    var C0 = 0x98badcfe;
    var D0 = 0x10325476;

    function RotateLeft(i, s)
    {
        return ((i << s) | (i >>> (32 - s)));
    }
    function UnsignedSum(x, y)
    {
        return (x + y) & 0xFFFFFFFF;
    }
    function toHexString(v)
    {
        var s = "";
        for (var i = 0; i < 4; i++)
            s += ((v >>> ((i * 8) + 4)) & 0x0f).toString(16) + ((v >>> (i * 8)) & 0x0f).toString(16);
        return s;
    }
    function dataPrepare(inData)
    {
        var d = inData;
        var l = d.length;
        var res = [];
        d += ns.StringFromCharCode(0x80);
        while (d.length % 4) d += ns.StringFromCharCode(0x0);
        for (var i = 0; i < d.length; i += 4)
            res.push((d.charCodeAt(i)) | (d.charCodeAt(i + 1) << 8) | (d.charCodeAt(i + 2) << 16) | (d.charCodeAt(i + 3) << 24));
        while (res.length % 16 !== 14) res.push(0x0);
        res.push(l << 3);
        res.push(l >>> 29);
        return res;
    }

    ns.md5 = function md5(data)
    {
        var words = dataPrepare(data);
        var A = A0;
        var B = B0;
        var C = C0;
        var D = D0;
        for (var i = 0; i < words.length; i += 16)
        {
            var a = A;
            var b = B;
            var c = C;
            var d = D;
            var block = words.slice(i, i + 16);
            for (var j = 0; j < 64; j++)
            {
                var f = 0;
                var g = 0;
                switch (Math.floor(j / 16))
                {
                    case 0:
                        f = (b & c) | ((~b) & d);
                        g = j;
                        break;
                    case 1:
                        f = (d & b) | ((~d) & c);
                        g = (5 * j) + 1;
                        break;
                    case 2:
                        f = b ^ c ^ d;
                        g = (3 * j) + 5;
                        break;
                    case 3:
                        f = c ^ (b | (~d));
                        g = 7 * j;
                        break;
                    default:
                }
                g -= 16 * Math.floor(g / 16);
                f = UnsignedSum(UnsignedSum(f, a), UnsignedSum(K[j], block[g]));
                a = d;
                d = c;
                c = b;
                b = UnsignedSum(b, RotateLeft(f, S[j]));
            }
            A = UnsignedSum(A, a);
            B = UnsignedSum(B, b);
            C = UnsignedSum(C, c);
            D = UnsignedSum(D, d);

        }
        var digest = toHexString(A) + toHexString(B) + toHexString(C) + toHexString(D);
        return digest;
    };

})(AvNs);

var avSessionInstance = null;
(function SessionMain(ns)
{
    var runners = {};
    var lastPostponedInitTime = ns.GetCurrentTime();
    var postponedInitTimeout = null;
    var enableTracing = false;
    var initPending = false;
    var restartInterval = 0;
    var sessionMarkedForbidden = false;


    var CallReceiver = function CallReceiver(caller)
    {
        var m_plugins = {};
        var m_receiver = caller.GetReceiver();
        var m_caller = caller;
        var m_selfMethods = {};

        function GetPluginIdFromMethodName(methodName)
        {
            if (methodName)
            {
                var names = ns.StringSplit.call(methodName, ".", 2);
                if (names.length === 2)
                    return names[0];
            }
            return null;
        }

        function GetPluginMethods(pluginId)
        {
            var plugin = m_plugins[pluginId];
            return plugin ? plugin.methods : null;
        }

        function CheckCommonMethodName(methodName)
        {
            if (methodName)
            {
                var names = ns.StringSplit.call(methodName, ".", 2);
                if (names.length === 1 && names[0] === methodName)
                    return true;
            }
            return false;
        }

        this.RegisterMethod = function RegisterMethod(methodName, callback)
        {
            var pluginId = GetPluginIdFromMethodName(methodName);
            if (pluginId)
            {
                var methods = GetPluginMethods(pluginId);
                if (methods)
                {
                    if (methods[methodName])
                        return;

                    methods[methodName] = callback;
                }
                else
                {
                    throw new Error("Cannot registered " + methodName);
                }
            }
            else if (CheckCommonMethodName(methodName))
            {
                if (m_selfMethods[methodName])
                    throw new Error("Already registered method " + methodName);
                m_selfMethods[methodName] = callback;
            }
        };

        function CallPluginMethod(pluginId, methodName, args)
        {
            var callback = null;
            if (pluginId)
            {
                var methods = GetPluginMethods(pluginId);
                if (methods) 
                    callback = methods[methodName];
            } 
            else
            {
                callback = m_selfMethods[methodName];
            }
            if (callback)
            {
                var result = {};
                try 
                {
                    if (args)
                        callback(ns.JSONParse(args));
                    else
                        callback();
                    result.success = true;
                    m_caller.SendResult(methodName, ns.JSONStringify(result));
                    return true;
                }
                catch (e)
                {
                    result.success = false;
                    m_caller.SendResult(methodName, ns.JSONStringify(result));
                    ns.SessionError(e, (pluginId ? pluginId : "common"));
                    return false;
                }
            }
            ns.SessionLog("Cannot call " + methodName + " for plugin " + (pluginId ? pluginId : "common"));
            return false;
        }

        function CallMethod(methodName, args)
        {
            var pluginId = GetPluginIdFromMethodName(methodName);
            if (pluginId || CheckCommonMethodName(methodName))
                CallPluginMethod(pluginId, methodName, args);
        }

        function ReportPluginError(pluginId, status)
        {
            var onError = m_plugins[pluginId].onError;
            if (onError)
                onError(status);
        }

        function ReportError(status)
        {
            for (var pluginId in m_plugins)
            {
                if (ns.ObjectHasOwnProperty.call(m_plugins, pluginId))
                    ReportPluginError(pluginId, status);
            }
        }

        function UpdateDelay()
        {
            var newDelay = ns.MaxRequestDelay;
            var currentTime = ns.GetCurrentTime();

            for (var pluginId in m_plugins)
            {
                if (!ns.ObjectHasOwnProperty.call(m_plugins, pluginId))
                    continue;

                try 
                {   
                    var onPing = m_plugins[pluginId].onPing;
                    if (onPing)
                    {
                        var delay = onPing(currentTime);
                        if (delay < newDelay && delay > 0 && delay < ns.MaxRequestDelay)
                            newDelay = delay;
                    }
                }
                catch (e)
                {
                    ReportPluginError(pluginId, "UpdateDelay: " + (e.message || e));
                }
            }

            return newDelay;
        }

        this.RegisterPlugin = function RegisterPlugin(pluginId, callbackPing, callbackError, callbackShutdown)
        {
            if (m_plugins[pluginId])
                return;

            var plugin = {
                onError: callbackError,
                onPing: callbackPing,
                onShutdown: callbackShutdown,
                methods: {}
            };

            m_plugins[pluginId] = plugin;

            if (!m_receiver.IsStarted())
                m_receiver.StartReceive(CallMethod, ReportError, UpdateDelay);
        };

        function IsPluginListEmpty()
        {
            for (var key in m_plugins)
            {
                if (ns.ObjectHasOwnProperty.call(m_plugins, key))
                    return false;
            }
            return true;
        }

        this.UnregisterPlugin = function UnregisterPlugin(pluginId)
        {
            delete m_plugins[pluginId];

            if (IsPluginListEmpty())
                m_receiver.StopReceive();
        };

        this.ForceReceive = function ForceReceive()
        {
            m_receiver.ForceReceive();
        };

        this.StopReceive = function StopReceive()
        {
            m_receiver.StopReceive();
        };

        this.UnregisterAll = function UnregisterAll()
        {
            if (IsPluginListEmpty())
                return;

            for (var key in m_plugins)
            {
                if (ns.ObjectHasOwnProperty.call(m_plugins, key)) 
                    m_plugins[key].onShutdown();
            }

            m_plugins = {};
        };

        this.IsEmpty = IsPluginListEmpty;
        this.IsProductConnected = function IsProductConnected()
        {
            return m_receiver.IsProductConnected();
        };
    };

    function LocalizationObjectFromDictionary(dictionary)
    {
        var object = {};
        if (dictionary)
        {
            for (var i = 0; i < dictionary.length; i++)
                object[dictionary[i].name] = dictionary[i].value;
        }
        return object;
    }

    function SettingsObjectFromSettingsJson(settingsJson)
    {
        var object = {};
        if (settingsJson)
            object = ns.JSONParse(settingsJson);
        return object;
    }

    var AvSessionClass = function AvSessionClass(caller)
    {
        var self = this;
        var m_caller = caller;
        var m_callReceiver = new CallReceiver(caller);


        function Call(methodName, argsObj, callbackResult, callbackError)
        {
            if (!m_callReceiver.IsProductConnected())
                return;

            if (methodName === "nms")
            {
                if (!m_caller.nmsCallSupported)
                {
                    ns.LogError("Unsupported nms call", "common");
                    return;
                }

                const method = typeof argsObj === "object" ? "nms" + ns.JSONStringify(argsObj) : argsObj;
                m_caller.Call("nms", method, null, null, null);
                return;
            }
            var callback = function callback(result, args, method)
                {
                    if (callbackResult)
                        callbackResult(result, args ? ns.JSONParse(args) : null, method);
                };
            var data = (argsObj)
                ? ns.JSONStringify(
                    {
                        result: 0,
                        method: methodName,
                        parameters: ns.JSONStringify(argsObj)
                    }
                    )
                : null;

            m_caller.Call("to", methodName, data, callback, callbackError);
        }

        function OnUnloadCall()
        {
            return false;
        }

        function StopImpl(reason)
        {
            try
            {
                m_callReceiver.UnregisterAll();

                if (m_callReceiver.IsProductConnected())
                    m_caller.Call("shutdown", reason);
                m_callReceiver.StopReceive();

                if (m_caller.Shutdown)
                    m_caller.Shutdown();
            }
            catch (e)
            {
            }
        }

        function DeactivatePlugin(pluginId)
        {
            m_callReceiver.UnregisterPlugin(pluginId);
            if (m_callReceiver.IsEmpty())
                StopImpl();
        }

        function ActivatePlugin(pluginId, callbackPing, callbackError, callbackShutdown)
        {
            m_callReceiver.RegisterPlugin(
                pluginId,
                callbackPing,
                function RegisterPluginOnError(e)
                {
                    callbackError && callbackError(e);
                    m_callReceiver.UnregisterPlugin(pluginId);
                    if (m_callReceiver.IsEmpty())
                        StopImpl();
                },
                function RegisterPluginOnShutdown()
                {
                    try
                    {
                        callbackShutdown && callbackShutdown();
                    }
                    catch (ex)
                    {
                        ns.SessionError(ex, pluginId);
                    }
                }
            );
        }

        function RegisterMethod(methodName, callback)
        {
            m_callReceiver.RegisterMethod(methodName, callback);
        }

        function ReloadImpl()
        {
            if (ns.StartLocationHref !== document.location.href)
                ns.WindowHistoryPushState(0, document.title, ns.StartLocationHref);
            window.location.reload(true);
        }

        function ServiceWorkerAllowed()
        {
            try
            {
                return navigator && navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.state === "activated";
            }
            catch (e)
            {
                ns.SessionLog("Service worker not allowed. Error: " + e.message);
                return false;
            }
        }

        function Redirect(param)
        {
            document.location.href = param.targetUrl;
        }

        function ReloadPage()
        {
            if (ServiceWorkerAllowed())
            {
                ns.SetTimeout(ReloadImpl, 1000);
                navigator.serviceWorker.getRegistrations()
                    .then(function getRegistrationsThen(regs)
                        {
                            var countUnregistered = 0;
                            var rest = function rest()
                                {
                                    ++countUnregistered;
                                    if (countUnregistered === regs.length)
                                        ReloadImpl();
                                }; 
                            for (var i = 0; i < regs.length; ++i)
                            {
                                regs[i].unregister()
                                    .then(rest, rest);
                            }
                        }, ReloadImpl);
            }
            else
            {
                ns.SetTimeout(ReloadImpl, 300);
            }
        }

        function OnStartError(injectorName)
        {
            try 
            {
                var connectionErrorCallback = runners[injectorName].onConnectionError;
                if (connectionErrorCallback)
                    connectionErrorCallback();
            }
            catch (e)
            {
                ns.Log(e);
            }
        }

        function StartInjector(param)
        {
            var pluginStartData = {};
            var runner = runners[param.injectorName];
            if (runner && runner.getParameters)
                pluginStartData = { plugin: runner, parameters: ns.JSONStringify(runner.getParameters()) };

            var startData =
                {
                    url: ns.StartLocationHref,
                    plugins: param.injectorName,
                    data: { data: pluginStartData },
                    isTopLevel: ns.IsTopLevel,
                    pageStartTime: ns.GetPageStartTime(),
                    navigationStartTime: ns.GetPageStartNavigationTime()
                };

            m_caller.StartCall(
                startData,
                function StartCallCallback(plugin)
                {
                    if (runner && plugin)
                    {
                        var settings = ns.IsDefined(plugin.settingsJson) ? SettingsObjectFromSettingsJson(plugin.settingsJson) : plugin.settings;
                        var localization = ns.IsDefined(plugin.localizationDictionary) ? LocalizationObjectFromDictionary(plugin.localizationDictionary) : {};
                        runner.runner(AvNs, avSessionInstance, settings, localization);
                    }
                },
                function StartCallOnError()
                { 
                    OnStartError(param.injectorName);
                }
                );
        }

        function OnStopError(injectorName)
        {
            ns.Log("Stop " + injectorName + "injector failed");
        }

        function StopInjector(param)
        {
            var runner = runners[param.injectorName];

            m_caller.StopCall(
                param.injectorName,
                function StopCallCallback(plugin)
                {
                    try
                    {
                        if (runner && plugin && runner.stop)
                            runner.stop(AvNs, avSessionInstance);
                    }
                    catch (e)
                    {
                        ns.SessionError(e, plugin);
                    }
                },
                function StopCallOnError() { OnStopError(param.injectorName); }
                );
        }

        function GetErrorMessage(error)
        {
            var msg = "";
            if (error instanceof Error)
            {
                msg = error.message;
                if (error.stack)
                    msg += "\r\n" + error.stack;
            }
            else if (error instanceof Object)
            {
                msg = ns.JSONStringify(error);
            }
            else
            {
                msg = String(error);
            }
            return msg.length <= 2048 ? msg : (msg.substring(0, 2048) + "<...>");
        }

        function ExtractStackWithRegexp(stack, regexp)
        {
            const resultArray = [...stack.matchAll(regexp)];
            return resultArray.map(m => m[1]);
        }

        function ExtractStack(error)
        {
            if (!error.stack)
                return "";

            const extractedStack = ExtractStackWithRegexp(error.stack, /at ([\w\s.]*) \(chrome-extension:\/\/\w*((?:\/[\w.]*)*(?::\d*){2})\)/g);
            if (extractedStack)
                return extractedStack.join("\n");

            return error.stack;
        }

        RegisterMethod("redirect", Redirect);
        RegisterMethod("reload", ReloadPage);
        RegisterMethod("start", StartInjector);
        RegisterMethod("stop", StopInjector);


        this.Reload = function Reload()
        {
            ReloadPage();
        };

        this.Log = function Log(error)
        {
            try
            {
                if (!(this.IsProductConnected() && enableTracing))
                    return;

                m_caller.SendLog(GetErrorMessage(error));
            }
            catch (e)
            {
                ns.Log(e.message || e);
            }
        };

        this.LogError = function LogError(error, injector)
        {
            try
            {
                if (!m_callReceiver.IsProductConnected())
                    return;
                if (!injector)
                    injector = "common"; 

                var result = { injector: injector };
                var details = { topLevel: ns.IsTopLevel };

                if (typeof error === "object")
                {
                    result.error2 = error.message ? error.message : "unknown";
                    result.stack = ExtractStack(error);
                    details.errorDetails = error.details;
                    result.error = result.error2;
                    if (details.errorDetails)
                    {
                        result.error += "\n" + (typeof details.errorDetails === "object")
                            ? ns.JSONStringify(details.errorDetails)
                            : details.errorDetails;
                    }
                    if (result.stack)
                        result.error += "\n" + result.stack;
                }
                else
                {
                    result.error  = error;
                    var m = ns.StringSplit.call(error, "\n");
                    result.error2 = m[0];
                    details.errorDetails = m.slice(1).join("\n");
                }
                details.manifestVersion = browsersApi.runtime.getManifest().version;

                result.details = ns.JSONStringify(details);
                m_caller.SessionErrorCall(ns.JSONStringify(result));
            }
            catch (e)
            {
                ns.Log(e.message || e);
            }
        };
        function IsNeedSkipError()
        {
            return true;
        }

        this.UnhandledException = function UnhandledException(e)
        {
            try
            {
                if (IsNeedSkipError(e))
                    return;

                var errInfo = {};
                errInfo.error = e.message && e.message.length > 1024 ? (e.message.substring(0, 1019) + "<...>") : e.message;
                errInfo.script = e.filename && e.filename.length > 1024 ? (e.filename.substring(0, 1019) + "<...>") : e.filename;
                errInfo.line = e.lineno;
                errInfo.column = e.colno;
                if (e.error)
                    errInfo.stack = e.error.stack && e.error.stack.length > 2048 ? (e.error.stack.substring(0, 2043) + "<...>") : e.error.stack;

                m_caller.UnhandledExceptionCall(ns.JSONStringify(errInfo));
                return;
            }
            catch (ex)
            {
                ns.Log(ex.message || ex);
            }
        };

        this.ForceReceive = function ForceReceive()
        {
            m_callReceiver.ForceReceive();
        };

        this.IsProductConnected = function IsProductConnected()
        {
            return m_callReceiver.IsProductConnected();
        };

        this.InitializePlugin = function InitializePlugin(init)
        {
            init(
                function OnInitActivatePlugin()
                {
                    ActivatePlugin.apply(self, arguments);
                },
                function OnInitRegisterMethod()
                {
                    RegisterMethod.apply(self, arguments);
                },
                function OnInitCall()
                {
                    Call.apply(self, arguments);
                },
                function OnInitDeactivatePlugin()
                {
                    DeactivatePlugin.apply(self, arguments);
                },
                function OnInitOnUnloadCall()
                {
                    return OnUnloadCall.apply(self, arguments);
                }
            );
        };

        this.GetResource = function GetResource(resourcePostfix, callbackSuccess, callbackError)
        {
            if (!m_caller.ResourceCall)
                throw new Error("Not implemented on transport GetResource");

            m_caller.ResourceCall(resourcePostfix, callbackSuccess, callbackError);
        };

        this.Stop = function Stop(reason)
        {
            StopImpl(reason);
        };
    };

    ns.AddRunner = function AddRunner(pluginName, runnerFunc, initParameters, onConnectionError)
    {
        var options = {
            name: pluginName,
            runner: runnerFunc
        };
        if (initParameters)
            options.getParameters = function getParameters() { return initParameters; };
        if (onConnectionError)
            options.onConnectionError = onConnectionError;
        ns.AddRunner2(options);
    };

    ns.AddRunner2 = function AddRunner2(options)
    {
        var runnerItem = {
            runner: options.runner
        };
        if (options.stop)
            runnerItem.stop = options.stop;
        if (options.onConnectionError)
            runnerItem.onConnectionError = options.onConnectionError;
        if (options.getParameters)
            runnerItem.getParameters = options.getParameters;
        if (options.reject)
            runnerItem.reject = options.reject;
        runners[options.name] = runnerItem;
    };

    ns.SessionLog = function SessionLog(e)
    {
        if (avSessionInstance)
        {
            avSessionInstance.Log(e);
            return;
        }

        ns.Log(e);
    };

    ns.SessionError = function SessionError(e, injector)
    {
        if (avSessionInstance && avSessionInstance.IsProductConnected())
            avSessionInstance.LogError(e, injector);
        else
            ns.Log(e);
    };


    ns.ContentSecurityPolicyNonceAttribute = ns.CSP_NONCE;

    function Init()
    {
        if (initPending || sessionMarkedForbidden)
            return;

        if (avSessionInstance && avSessionInstance.IsProductConnected())
            return;

        initPending = true;

        var caller = new ns.Caller();
        caller.Start(
            function StartCallback() 
            {
                var injectors = "";
                var pluginsInitData = [];
                var injectorNames = [];
                for (var runner in runners)
                {
                    if (!ns.ObjectHasOwnProperty.call(runners, runner))
                        continue;

                    if (injectors)
                        injectors += "&";
                    injectors += runner;
                    injectorNames.push(runner);

                    if (runners[runner].getParameters)
                        pluginsInitData.push({ plugin: runner, parameters: ns.JSONStringify(runners[runner].getParameters()) });
                }

                var initData = 
                    {
                        url: ns.StartLocationHref,
                        plugins: injectors,
                        data: { data: pluginsInitData },
                        isTopLevel: ns.IsTopLevel,
                        pageStartTime: ns.GetPageStartTime(),
                        navigationStartTime: ns.GetPageStartNavigationTime()
                    };

                caller.InitCall(
                    initData,
                    function InitCallCallback(initSettings)
                    {
                        ns.IsRtl = initSettings.rtl;
                        enableTracing = ns.IsDefined(initSettings.enableTracing) ? initSettings.enableTracing : true;
                        avSessionInstance = new AvSessionClass(caller);
                        var plugins = initSettings.plugins || [];
                        for (var i = 0, pluginsCount = plugins.length; i < pluginsCount; ++i)
                        {
                            try
                            {
                                var plugin = plugins[i];
                                var runnerItem = runners[plugin.name];

                                if (runnerItem)
                                {
                                    var settings = ns.IsDefined(plugin.settingsJson) ? SettingsObjectFromSettingsJson(plugin.settingsJson) : plugin.settings;
                                    var localization = ns.IsDefined(plugin.localizationDictionary) 
                                        ? LocalizationObjectFromDictionary(plugin.localizationDictionary) 
                                        : plugin.localization;
                                    runnerItem.runner(AvNs, avSessionInstance, settings, localization);
                                }
                            }
                            catch (e)
                            {
                                e.message = "Init error: " + e.message;
                                ns.SessionError(e, plugins[i].name);
                            }
                        }
                        for (var j = 0; j < injectorNames.length; ++j)
                        {
                            try
                            {
                                var injectorName = injectorNames[j];
                                var runnerItemHolder = runners[injectorName];
                                if (!IsInjectorInActiveList(plugins, injectorName) && runnerItemHolder.reject)
                                    runnerItemHolder.reject();
                            }
                            catch (e)
                            {
                                ns.SessionError(e);
                            }
                        }

                        initPending = false;
                        ns.SessionLog("Session: " + initSettings.sessionId + " initialization complete time: " + ns.GetCurrentIsoDate() +
                            " document.readyState is " + document.readyState);
                    },
                    OnInitError
                    );
            },
            OnInitError
            );
    }

    function IsInjectorInActiveList(plugins, injectorName)
    {
        for (var i = 0; i < plugins.length; ++i)
        {
            if (plugins[i].name === injectorName)
                return true;
        }
        return false;
    }

    function PostponeInit()
    {
        var nowPostponeTime = ns.GetCurrentTime();
        var postponeDelay = (nowPostponeTime - lastPostponedInitTime) > 5000 ? 200 : 60 * 1000;
        lastPostponedInitTime = nowPostponeTime;
        ns.ClearTimeout(postponedInitTimeout);
        postponedInitTimeout = ns.SetTimeout(Init, postponeDelay);
    }

    function OnInitError(message, details)
    {
        if (details && details.forbidden)
        {
            ns.ClearInterval(restartInterval);
            restartInterval = 0;
            sessionMarkedForbidden = true;
        }
        else
        {
            PostponeInit();
        }

        for (var runner in runners)
        {
            if (!ns.ObjectHasOwnProperty.call(runners, runner))
                continue;
            try
            {
                var connectionErrorCallback = runners[runner].onConnectionError;
                if (connectionErrorCallback)
                    connectionErrorCallback();
            }
            catch (e)
            {
                AvNs.SessionLog(e);
            }
        }

        initPending = false;
    }

    ns.StartSession = function StartSession()
    {
        ns.ClearInterval(restartInterval);
        restartInterval = ns.SetInterval(PostponeInit, 30000);        
        Init();
    };

    ns.StopSession = function StopSession(reason)
    {
        if (avSessionInstance)
            avSessionInstance.Stop(reason);
    };

    if ("onpageshow" in window)
    {
        ns.AddEventListener(
            window,
            "pageshow",
            function onPageShow(event)
            {
                try
                {
                    if (event.persisted)
                        ns.StartSession();
                }
                catch (e)
                {
                    AvNs.SessionLog(e);
                }
            }
        );
    }

    ns.AddEventListener(
        window,
        ("onpagehide" in window) ? "pagehide" : "unload",
        function onShutdownEvent(evt)
        {
            ns.StopSession(evt.type);
        }
    );
})(AvNs);

(function NmsTransportMain(ns)
{

ns.Caller = function ContentTransportCaller()
{
    let m_port = null;

    const m_waitResponse = {};
    let m_callReceiver = ns.EmptyFunc;
    let m_callReceiverEnabled = false;
    let m_connected = false;
    let m_initialized = false;
    let m_deferredCalls = [];
    let m_callId = 0;

    function ProcessMessage(response)
    {
        try
        {
            if (m_waitResponse[response.callId])
            {
                const callWaiter = m_waitResponse[response.callId];
                delete m_waitResponse[response.callId];
                ns.ClearTimeout(callWaiter.timeout);

                if (callWaiter.callbackResult)
                    callWaiter.callbackResult(response.commandData);
                return;
            }

            if (!m_initialized)
            {
                m_deferredCalls.push(response);
                return;
            }

            if (response.command === "from")
            {
                const command = ns.JSONParse(response.commandData);
                m_callReceiver(command.method, command.parameters);
            }
        }
        catch (e)
        {
            ns.SessionError(e, "nms");
        }
    }

    function ConnectToBackground(callbackSuccess, callbackError)
    {
        const onConnect = connectData =>
        {
            ns.GetNmsId = () => connectData.portId;
            ns.GetNmsVersion = () => connectData.version;
            m_port.onMessage.addListener(ProcessMessage);
            m_port.onMessage.removeListener(onConnect);
            m_connected = true;
            if (callbackSuccess)
                callbackSuccess();
        };

        const onDisconnect = () =>
        {
            let reason = "unknown";
            if (browsersApi.runtime.lastError)
                reason = browsersApi.runtime.lastError.message;
            m_connected = false;
            callbackError(`Connection was disconnect: ${reason}`);

            m_port.onMessage.removeListener(onConnect);
            m_port.onMessage.removeListener(ProcessMessage);
            m_port.onDisconnect.removeListener(onDisconnect);
        };

        m_port = browsersApi.runtime.connect({ name: "content_transport" });
        m_port.onDisconnect.addListener(onDisconnect);
        m_port.onMessage.addListener(onConnect);
    }

    function CallImpl(command, commandAttribute, data, callbackResult, callbackError)
    {
        try
        {
            if (++m_callId % 0x100000000 === 0)
                m_callId = 1;

            const callId = m_callId;
            if (callbackResult || callbackError)
            {
                const timeout = ns.SetTimeout(() =>
                    {
                        delete m_waitResponse[callId];
                        callbackError && callbackError(`NMS call timeout for ${command}/${commandAttribute}`);
                    }, 120000, "nms");
                const callWaiter = 
                    {
                        callbackResult: callbackResult,
                        timeout: timeout
                    };
                m_waitResponse[callId] = callWaiter;
            }

            m_port.postMessage(
                {
                    callId: callId,
                    command: command,
                    commandAttribute: commandAttribute || "",
                    commandData: data || "",
                    timestamp: ns.GetCurrentIsoDate()
                }
            );
        }
        catch (e)
        {
            callbackError && callbackError(`Connection call ${command}/${commandAttribute} exception: ${e}`);
        }
    }

    this.Start = (callbackSuccess, callbackError) =>
    {
        try
        {
            ConnectToBackground(callbackSuccess, callbackError);
        }
        catch (e)
        {
            callbackError && callbackError(`Connection start exception: ${e}`);
        }
    };

    this.SendLog = message => { CallImpl("log", null, message); };
    this.SendResult = (methodName, data) => { CallImpl("callResult", methodName, data); };
    this.SessionErrorCall = message => { CallImpl("logerr", null, message); };
    this.UnhandledExceptionCall = message => { CallImpl("except", null, message); };
    this.Call = (command, commandAttribute, data, callbackResult, callbackError) =>
    {
        CallImpl(
            command,
            commandAttribute,
            data,
            callbackResult
                ? responseText =>
                    {
                        if (callbackResult)
                        {
                            try
                            {
                                const response = ns.JSONParse(responseText);
                                callbackResult(response.result, response.parameters, response.method);
                            }
                            catch (e)
                            {
                                CallImpl("log", null, `error on parse message: ${responseText} error: ${e}`);
                                callbackError && callbackError(e);
                            }
                        }
                    }
                : null,
            callbackError
            );
    };

    this.nmsCallSupported = true;

    this.ResourceCall = (resourcePostfix, callbackResult, callbackError) =>
    {
        CallImpl("resource", "", resourcePostfix, callbackResult, callbackError);
    };

    this.InitCall = (initData, callbackResult, callbackError) =>
    {
        if (ns.StartLocationHref === "data:text/html,chromewebdata")
        {
            callbackError();
            return;
        }

        CallImpl("init", null, ns.JSONStringify(initData), responseText =>
            {
                m_initialized = true;
                const initSettings = ns.JSONParse(responseText);

                if (ns.IsDefined(initSettings.Shutdown))
                    return;

                callbackResult(initSettings);

                for (let i = 0; i < m_deferredCalls.length; ++i)
                    ProcessMessage(m_deferredCalls[i]);
                m_deferredCalls = [];
            }, callbackError);
    };

    this.StartCall = (startData, callbackResult, callbackError) =>
    {
        CallImpl(
            "start",
            null,
            ns.JSONStringify(startData),
            responseText => { callbackResult(ns.JSONParse(responseText)); },
            callbackError
        );
    };
    this.StopCall = (injector, callbackResult, callbackError) =>
    {
        CallImpl(
            "stop",
            null,
            ns.JSONStringify({ injectorName: injector }),
            responseText => { callbackResult(ns.JSONParse(responseText)); },
            callbackError
        );
    };
    this.GetReceiver = () => this;
    this.StartReceive = callMethod =>
    {
        m_callReceiverEnabled = true;
        m_callReceiver = callMethod;
    };
    this.ForceReceive = ns.EmptyFunc;
    this.StopReceive = () =>
    {
        m_callReceiverEnabled = false;
        m_callReceiver = ns.EmptyFunc;

        if (m_port)
        {
            m_connected = false;
            m_port.disconnect();
            m_port = null;
        }
    };
    this.IsStarted = () => m_callReceiverEnabled;
    this.IsProductConnected = () => m_connected;
};

return ns;
})(AvNs);

const m_globalTimer = AvNs.SetTimeout(() => { document.getElementsByTagName("body")[0].className = "failed"; }, 15000, "er");

function RunnerImpl(ns, session, settings, locales)
{
    let m_callFunction = () => {};
    const m_pluginId = "er";

    const ReadyState = 1;
    const SuccessState = 2;
    const FailState = 3;

    const Fail = 0x8000004b;

    function GetStringState(state)
    {
        switch (state)
        {
        case ReadyState:
            return "ready";
        case SuccessState:
            return "success";
        case FailState:
            return "failed";
        default:
            return "";
        }
    }

    function SetState(state)
    {
        try
        {
            document.getElementsByTagName("body")[0].className = GetStringState(state);
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function DeletePluginClick(evt)
    {
        ns.StopProcessingEvent(evt);
        ns.SessionLog(`Call management.uninstall for ${settings.id}`);
        ApiCall(browsersApi.management.uninstall)
            .OnSuccess(() =>
                {
                    m_callFunction("er.removed");
                    SetState(SuccessState);
                })
            .OnError(err => ProcessFail(Fail, `management.uninstall error: ${err.message} Result: eFail`))
            .Start(settings.id);
    }

    function ExitClick(evt)
    {
        ns.StopProcessingEvent(evt);
        window.close();
    }

    function ProcessFail(result, errorText)
    {
        m_callFunction("er.failedRemove", { code: result, errorText: errorText });
        SetState(FailState);
    }

    function OnPluginInfoReceived(info)
    {
        if (!info.name)
            return;

        if (info.icons && info.icons[0] && info.icons[0].url)
            document.getElementById("extension-ico").src = info.icons[0].url;
        document.getElementById("extension-name").appendChild(document.createTextNode(info.name));
        SetState(ReadyState);
    }

    function Initialize()
    {
        ns.ClearTimeout(m_globalTimer);
        session.InitializePlugin((activatePlugin, registerMethod, callFunction) => { m_callFunction = callFunction; });

        ns.AddEventListener(document.getElementById("dbutton"), "click", DeletePluginClick, m_pluginId);
        ns.AddEventListener(document.getElementById("cbutton"), "click", ExitClick, m_pluginId);
        ns.AddEventListener(document.getElementById("ebutton"), "click", ExitClick, m_pluginId);

        document.getElementById("ExtRemoverSuccessWindowLinkAboutText").href = settings.urlAbout;
        const liElem = document.getElementById("delete-reason-element");
        if (settings.verdicts)
        {
            for (const descriptor in settings.verdicts)
            {
                if ({}.hasOwnProperty.call(settings.verdicts, descriptor))
                {
                    const newElem = liElem.cloneNode(true);
                    newElem.getElementsByClassName("delete-reason-element-verdict")[0].childNodes[0].appendChild(document.createTextNode(descriptor.verdict));
                    liElem.parentNode.insertBefore(newElem, liElem);
                }
            }
            liElem.parentNode.removeChild(liElem);
        }

        for (const name in locales)
        {
            if ({}.hasOwnProperty.call(locales, name))
            {
                const elem = document.getElementById(name);
                if (elem)
                    elem.innerText = locales[name];
            }
        }

        const addingStyles = [];
        addingStyles.push(locales["ExtensionRemoverCss"]);
        ns.AddStyles(addingStyles);

        ns.SessionLog(`Call management.get for ${settings.id}`);
        ApiCall(browsersApi.management.get)
            .OnSuccess(OnPluginInfoReceived)
            .OnError(err => ProcessFail(-1, `management.get error: ${err.message}`))
            .Start(settings.id);
    }

    Initialize();
}

function GetRemoveId()
{
    const result = document.location.search.match(/\?id=([\d-\w]*)/);
    return { removeId: result[1] };
}

AvNs.AddRunner2({
    name: "er2",
    runner: RunnerImpl,
    getParameters: GetRemoveId
});

AvNs.StartSession();
