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
