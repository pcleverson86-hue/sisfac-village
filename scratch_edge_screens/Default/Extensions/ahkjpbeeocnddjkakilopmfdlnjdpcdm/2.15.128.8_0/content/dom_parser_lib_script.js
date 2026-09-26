(function DomParserMain(ns)
{

var m_pluginId = "dp";
function DomParser(session)
{
    var m_callFunction = ns.EmptyFunc;
    var m_logins = [];
    var m_passwords = [];
    var m_newPasswords = [];
    var m_address = [];
    var m_card = [];
    var m_cachedFlag = false;
    var m_pathName = GetCurrentPathname();

    var m_selectorsRequested = false;
    var m_callbacksQueue = [];
    var m_idCounter = 0;
    var m_wfdIdCounter = 1;

    function GetCurrentPathname()
    {
        if (document.location)
            return document.location.pathname;
        var currentUrl = ns.TryCreateUrl(document.URL);
        if (currentUrl)
            return currentUrl.pathname;
        ns.SessionError("Location is empty. Can't create URL from " + document.URL + ". Pathname not accessible", m_pluginId);
        return "";
    }

    function OnGetFieldsCallback(result, selectors)
    {
        if (result === 0 && selectors)
        {
            if (selectors.loginSelectors)
                Array.prototype.push.apply(m_logins, selectors.loginSelectors);
            if (selectors.passwordSelectors)
                Array.prototype.push.apply(m_passwords, selectors.passwordSelectors);
            if (selectors.newPasswordSelectors)
                Array.prototype.push.apply(m_newPasswords, selectors.newPasswordSelectors);
            if (selectors.addressSelectors)
                Array.prototype.push.apply(m_address, selectors.addressSelectors);
            if (selectors.cardSelectors)
                Array.prototype.push.apply(m_card, selectors.cardSelectors);
            m_cachedFlag = true;
        }
        else
        {
            ns.SessionLog("Get fields result: " + result);
        }
        m_selectorsRequested = false;

        ns.SessionLog("Dom parser call get field callbacks: " + m_callbacksQueue.length);
        for (var i = 0; i < m_callbacksQueue.length; ++i)
            m_callbacksQueue[i](result);
    }
    function CleanupElements()
    {
        if (!ns.HasDocumentQuerySelectorAll())
            return;
        var elements = ns.DocumentQuerySelectorAll("[wfd-value],[wfd-invisible]");
        for (var i = 0; i < elements.length; ++i)
        {
            var element = elements[i];
            if (element.hasAttribute("wfd-value"))
                element.removeAttribute("wfd-value");

            if (element.hasAttribute("wfd-invisible"))
                element.removeAttribute("wfd-invisible");
        }
    }

    function CallService(argObject)
    {
        m_callFunction("dp.onGetFields", argObject, OnGetFieldsCallback);
        CleanupElements();
    }

    function ProcessChilds(childNodes)
    {
        for (var i = 0; i < childNodes.length; ++i)
        {
            var element = childNodes[i];
            if (element.nodeType !== Node.ELEMENT_NODE)
                continue;

            if (!ns.IsElementDisplayed(element))
            {
                ns.ElementSetAttribute.call(element, "wfd-invisible", true);
            }
            else
            {
                ns.ElementSetAttribute.call(element, "wfd-id", "id" + m_idCounter);
                ++m_idCounter;
                ProcessChilds(element.childNodes);
            }
        }
    }

    function ProcessNextGroupElement(tree, finishCallback)
    {
        var counter = 0;
        while (tree.nextNode())
        {
            ++counter;
            ns.ElementSetAttribute.call(tree.currentNode, "wfd-invisible", true);
            if (counter === 50)
            {
                ns.SetTimeout(function TimerCallback() { ProcessNextGroupElement(tree, finishCallback); }, 100, m_pluginId);
                return;
            }
        }
        finishCallback();
    }

    function GetSelectorsWithTreeWalker()
    {
        if (!document.body || !document.body.nodeType)
        {
            ns.AddEventListener(window, "load", GetSelectorsWithTreeWalker, m_pluginId);
            return;
        }
        ns.SessionLog("Get selectors with tree walker");

        var filter = {
            acceptNode: function acceptNode(node)
            {
                if (!node)
                    return NodeFilter.FILTER_SKIP;
                if (ns.TryGetTagName(node) === "INPUT")
                {
                    ns.ElementSetAttribute.call(node, "wfd-id", "id" + m_idCounter);
                    ++m_idCounter;
                }
                if (node.parentNode && typeof node.parentNode.getAttribute === "function" && node.parentNode.getAttribute("wfd-invisible") === true)
                    return NodeFilter.FILTER_REJECT;
                if (!ns.IsElementDisplayed(node))
                    return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
            }
        };

        var tree = ns.CreateTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, filter.acceptNode, false);
        function finishCallback()
        {
            ns.SessionLog("Get selectors with tree walker: call service");
            CallService({ dom: "<body>" + (document.body ? document.body.innerHTML : "") + "</body>" });
        }
        ProcessNextGroupElement(tree, finishCallback);
    }

    function GetSelectorsFromService()
    {
        try
        {
            ns.SessionLog("Get selectors from service");
            ProcessChilds(document.body.childNodes);
        }
        catch (e)
        {
            ns.SessionLog(e);
        }
        ns.SessionLog("Get selectors from service: call service");
        CallService({ dom: document.documentElement.innerHTML });
    }

    function GetSelectorsInternal(callback, selectors)
    {
        if (m_cachedFlag)
        {
            if (selectors.length > 0)
            {
                ns.SessionLog("Get selectors from cache");
                callback(0, selectors);
            }
            return;
        }

        function clientCallback(result) { callback(result, selectors); }
        m_callbacksQueue.push(clientCallback);
        if (!m_selectorsRequested)
        {
            m_selectorsRequested = true;
            if (document.createTreeWalker)
                GetSelectorsWithTreeWalker();
            else
                GetSelectorsFromService();
        }
    }

    function AddWfdAttribute(input, settings)
    {
        try
        {
            if (!input || !input.value)
                return;
            if (settings && settings.avoidTypes && input.type && settings.avoidTypes.includes(input.type))
                return;
            if (input.type === "password")
                return;

            ns.ElementSetAttribute.call(input, "wfd-value", ns.ToBase64(input.value));
        }
        catch (e)
        {
            ns.SessionLog(e);
        }
    }

    this.GetLoginSelectors = function GetLoginSelectors(clientCallback)
    {
        ns.SessionLog("Dom parser get Login selectors");
        GetSelectorsInternal(clientCallback, m_logins);
    };

    this.GetPasswordSelectors = function GetPasswordSelectors(clientCallback)
    {
        ns.SessionLog("Dom parser get password selectors");
        GetSelectorsInternal(clientCallback, m_passwords);
    };

    this.GetNewPasswordSelectors = function GetNewPasswordSelectors(clientCallback)
    {
        ns.SessionLog("Dom parser get new password selectors");
        GetSelectorsInternal(clientCallback, m_newPasswords);
    };

    this.GetAddressSelectors = function GetAddressSelectors(clientCallback)
    {
        ns.SessionLog("Dom parser get address selectors");
        GetSelectorsInternal(clientCallback, m_address);
    };

    this.GetCardSelectors = function GetCardSelectors(clientCallback)
    {
        ns.SessionLog("Dom parser get card selectors");
        GetSelectorsInternal(clientCallback, m_card);
    };

    function onGetCookiesFieldsCallback(clientCallback, result, selectorObject)
    {
        ns.SessionLog("Get cookie selector callback called");
        clientCallback(result, selectorObject);
    }

    this.GetCookieSelector = function GetCookieSelector(clientCallback)
    {
        ns.SessionLog("Get cookie selector called");
        var elements = [];
        elements = Array.prototype.concat.apply(elements, document.getElementsByTagName("div"));
        elements = Array.prototype.concat.apply(elements, document.getElementsByTagName("a"));
        elements = Array.prototype.concat.apply(elements, document.getElementsByTagName("button"));
        elements = Array.prototype.concat.apply(elements, document.getElementsByTagName("input"));

        ns.SessionLog("Elements for cookie selector size: " + elements.length);
        var callback = function CallToService()
        {
            m_callFunction("dp.onGetCookiesFields",
                { dom: "<body>" + (document.body ? document.body.innerHTML : "") + "</body>" },
                function CallCallback(res, args) { onGetCookiesFieldsCallback(clientCallback, res, args); });
        };

        SetWfdIdAttribute(elements, callback);
    };

    function GetTimerCallback(elements, i, finishCallback)
    {
        return function TimerCallback() { SetWfdIdAttribute(elements.slice(i), finishCallback); };
    }

    function SetWfdIdAttribute(elements, finishCallback)
    {
        if (elements)
        {
            for (var i = 0; i < elements.length; i++)
            {
                if (i === 50)
                {
                    ns.SetTimeout(GetTimerCallback(elements, i, finishCallback), 100, m_pluginId);
                    return;
                }
                if (!ns.IsElementDisplayed(elements[i]))
                {
                    ns.ElementSetAttribute.call(elements[i], "wfd-invisible", true);
                }
                else
                {
                    ns.ElementSetAttribute.call(elements[i], "wfd-id", m_wfdIdCounter);
                    m_wfdIdCounter++;
                }
            }
        }
        if (finishCallback)
            finishCallback();
    }

    this.SetWfdIds = function SetWfdIds(settings)
    {
        var inputs = document.getElementsByTagName("input");
        if (inputs)
        {
            for (var i = 0; i < inputs.length; i++)
                AddWfdAttribute(inputs[i], settings);
        }

        if (settings && settings.wfdIdSelector)
        {
            var elements = ns.DocumentQuerySelectorAll(settings.wfdIdSelector);
            if (elements)
            {
                for (var j = 0; j < elements.length; j++)
                {
                    if (!ns.IsElementDisplayed(elements[j]))
                    {
                        ns.ElementSetAttribute.call(elements[j], "wfd-invisible", true);
                    }
                    else
                    {
                        ns.ElementSetAttribute.call(elements[j], "wfd-id", m_wfdIdCounter);
                        m_wfdIdCounter++;
                    }
                }
            }
        }
        return document.documentElement.innerHTML;
    };

    this.Reset = function ResetDomParser()
    {
        ResetCacheFlag();
    };

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    function OnInitializeCallback(activatePlugin, registerMethod, callFunction)
    {
        m_callFunction = callFunction;
        activatePlugin(m_pluginId, OnPing);
    }

    function ResetCacheFlag()
    {
        ns.SessionLog("Reset cache flag");
        m_cachedFlag = false;
    }

    function UpdateLocationPathName()
    {
        var currentPathName = GetCurrentPathname();
        if (m_pathName !== currentPathName)
        {
            m_pathName = currentPathName;
            ResetCacheFlag();
        }
    }

    function OnMessage(request)
    {
        try
        {
            if (browsersApi.runtime.lastError)
                throw browsersApi.runtime.lastError;

            if (request.command && request.command === "HistoryStateUpdate")
                ResetCacheFlag();
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function InitializePlugin()
    {
        session.InitializePlugin(OnInitializeCallback);
        ns.AddEventListener(window, "popstate", ResetCacheFlag, m_pluginId);
        ns.AddEventListener(document, "load", UpdateLocationPathName, m_pluginId);
        browsersApi.runtime.onMessage.addListener(OnMessage);
    }
    InitializePlugin();
}

var gDomParser = null;

ns.GetDomParser = function GetDomParser(session)
{
    if (!gDomParser)
        gDomParser = new DomParser(session);

    return gDomParser;
};

return ns;

})(AvNs);
