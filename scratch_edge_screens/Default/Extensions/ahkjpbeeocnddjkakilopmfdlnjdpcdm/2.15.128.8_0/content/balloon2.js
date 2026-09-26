(function BallonMain(ns)
{

ns.Balloon2 = function Balloon2(pluginName, balloonSrc, balloonCssPostfix, session, getCoordCallback, onCloseHandler, locales, onDataReceiveHandler)
{
    var m_balloon = ns.DocumentCreateElement("iframe");
    var m_shadowRoot = null;
    var m_balloonId = pluginName + "_b";
    var m_balloonClassName = "b_KlBalloonClass"; 
    var m_balloonSize = null;
    var m_sizeCache = {};
    var m_initStyleDataPair = {};
    var m_isInitSent = false;
    var m_updateTimeout = null;
    var m_balloonElementInDom = false;
    var m_initData = null;
    var m_cssDataReady = false;
    var m_cssData = "";
    var m_port = null;
    var m_uniqueId = Math.floor((1 + Math.random()) * 0x10000).toString(16);

    function GetResourceUrl()
    {
        return browsersApi.runtime.getURL(`snapshot_resources${balloonSrc}`) + `?id=${m_uniqueId}`;
    }

    function HideBalloon()
    {
        m_balloon.style.display = "none";
    }

    function InitializeBalloon()
    {
        if (!document.body)
        {
            ns.AddEventListener(window, "load", InitializeBalloon, m_balloonId);
            return;
        }

        m_balloon.scrolling = "no";
        m_balloon.frameBorder = "0";
        m_balloon.style.border = "0";
        m_balloon.style.height = "1px";
        m_balloon.style.width = "1px";
        m_balloon.style.left = "1px";
        m_balloon.style.top = "1px";
        m_balloon.allowTransparency = "true"; 
        m_balloon.style.zIndex = "2147483647";
        m_balloon.style.position = "absolute";
        m_balloon.id = "KlIFrameId";

        if (ns.ElementAttachShadow)
        {
            m_shadowRoot = ns.DocumentCreateElement("div");
            ns.ElementSetAttribute.call(m_shadowRoot, "class", m_balloonClassName);
            var shadowRoot = ns.ElementAttachShadow.call(m_shadowRoot, { mode: "open" });
            ns.AppendChild(shadowRoot, m_balloon);
            ns.AppendChild(document.body, m_shadowRoot);
        }
        else
        {
            ns.AppendChild(document.body, m_balloon);
        }
        m_balloonElementInDom = true;

        HideBalloon();
    }

    function IsDisplayed()
    {
        return m_balloonElementInDom && m_balloon.style.display === "";
    }

    function OnPing()
    {
        return IsDisplayed() ? 100 : ns.MaxRequestDelay;
    }


    function SendToFrame(args)
    {
        if (m_port && (m_shadowRoot || document.body.contains(m_balloon)))
            m_port.postMessage(args);
    }

    function SendInit(dataToFrame)
    {
        dataToFrame.style = m_initStyleDataPair.style;
        dataToFrame.data = m_initStyleDataPair.data;
        m_isInitSent = true;
        SendToFrame(dataToFrame);
        session.ForceReceive();
    }
    function OnCssLoadError()
    {
        m_cssDataReady = true;
    }

    function SendInitOnReady()
    {
        if (m_cssDataReady && m_port && m_initData)
        {
            m_initData.cssData = m_cssData;
            SendInit(m_initData);
        }
    }

    function OnConnect(port)
    {
        try
        {
            const resourceUrl = new URL(GetResourceUrl());
            const portUrl = new URL(port.name);
            if (resourceUrl.pathname === portUrl.pathname && resourceUrl.search === portUrl.search)
            {
                m_port = port;
                m_port.onMessage.addListener(OnFrameDataMessage);
                m_port.onDisconnect.addListener(function onDisconnectDefault() { m_port = null; });
                SendInitOnReady();
            }
            else
            {
                ns.SessionLog(`Reject balloon port connected with url: ${port.name}`);
            }
        }
        catch (e)
        {
            ns.SessionError(e, m_balloonId);
        }
    }

    function OnCssLoad(data)
    {
        m_cssData = data;
        m_cssDataReady = true;
        SendInitOnReady();
    }   

    function PutSizeInCache(style, size)
    {
        m_sizeCache[style ? style.toString() : ""] = size;
    }

    function PositionBalloon()
    {
        if (!m_balloonSize)
            return;

        var coords = getCoordCallback(m_balloonSize);

        var newHeight = m_balloonSize.height + "px";
        var newWidth = m_balloonSize.width + "px";
        if (newHeight !== m_balloon.style.height 
            || newWidth !== m_balloon.style.width)
        {
            m_balloon.style.height = newHeight;
            m_balloon.style.width = newWidth;
            ns.SessionLog("Change balloon size " + m_balloonId + " height: " + newHeight + " width: " + newWidth);
        }

        if (!coords)
        {
            ns.SessionLog("Change balloon position skiped");
            return;
        }

        var newX = Math.round(coords.x).toString() + "px";
        var newY = Math.round(coords.y).toString() + "px";
        if (newX !== m_balloon.style.left 
            || newY !== m_balloon.style.top)
        {
            m_balloon.style.left = newX;
            m_balloon.style.top = newY;
            ns.SessionLog("Change balloon position " + m_balloonId + " x: " + newX + " y: " + newY);
        }
    }

    function SetupBalloon(balloonSize)
    {
        m_balloonSize = balloonSize;
        PositionBalloon();
    }

    function OnSizeMessage(sizeMessage)
    {
        var size = {
            height: sizeMessage.height,
            width: sizeMessage.width
        };
        if (size.height > 1 && size.width > 1)
            PutSizeInCache(sizeMessage.style, size);
        SetupBalloon(size);
    }

    function OnCloseMessage(closeData)
    {
        HideBalloon();
        if (onCloseHandler && closeData.closeAction)
            onCloseHandler(closeData.closeAction);
    }

    function OnDataMessage(data)
    {
        if (onDataReceiveHandler)
            onDataReceiveHandler(data);
    }

    function GetSizeFromCache(style)
    {
        return m_sizeCache[style ? style.toString() : ""];
    }

    function DisplayBalloon()
    {
        m_balloon.style.display = "";
        session.ForceReceive();
    }

    function UpdateBalloon(style, data)
    {
        if (!m_isInitSent)
            m_initStyleDataPair = { style: style, data: data };

        var sizeFromCache = GetSizeFromCache(style);
        ns.ClearTimeout(m_updateTimeout);
        if (sizeFromCache)
        {
            m_updateTimeout = ns.SetTimeout(function UpdateTimerCallback() { SetupBalloon(sizeFromCache); }, 0, "balloon_" + pluginName);
        }
        else
        {
            m_balloon.style.height = "1px";
            m_balloon.style.width = "1px";
            m_balloonSize = { height: 1, width: 1 };
        }

        var dataToFrame = {
            command: "update",
            style: style,
            data: data,
            needSize: !sizeFromCache
        };
        SendToFrame(dataToFrame);
    }

    function CreateBalloon(style, data, size)
    {
        if (!m_balloonElementInDom)
            InitializeBalloon();

        DisplayBalloon();

        if (m_balloon.src)
        {
            UpdateBalloon(style, data);
            return;
        }

        m_initStyleDataPair = { style: style, data: data };

        m_balloon.src = GetResourceUrl();

        var balloonSize = size ? size : GetSizeFromCache(style);
        var dataToFrame = {
            command: "init",
            pluginName: m_balloonId,
            isRtl: ns.IsRtl,
            needSize: !balloonSize,
            style: style
        };
        if (data)
            dataToFrame.data = data;
        if (size)
            dataToFrame.explicitSize = size;
        if (locales)
            dataToFrame.locales = locales;
        m_initData = dataToFrame;
        if (balloonSize)
        {
            ns.ClearTimeout(m_updateTimeout);
            m_updateTimeout = ns.SetTimeout(function UpdateTimerCallback() { SetupBalloon(balloonSize); }, 0);
        }
    }

    function DestroyBalloon()
    {
        if (!m_balloonElementInDom)
            return;
        m_balloon.blur(); 
        if (m_shadowRoot)
            ns.RemoveElement(m_shadowRoot);
        else
            ns.RemoveElement(m_balloon);
        m_balloonElementInDom = false;
        m_balloonSize = null;
    }

    this.Show = function Show(style, data)
    {
        CreateBalloon(style, data);
    };
    this.ShowWithSize = function ShowWithSize(style, data, size)
    {
        CreateBalloon(style, data, size);
    };

    this.Resize = function Resize(size)
    {
        SetupBalloon(size);
    };

    this.Hide = function Hide()
    {
        HideBalloon();
    };

    this.Update = function Update(style, data)
    {
        UpdateBalloon(style, data);
    };

    this.UpdatePosition = function UpdatePosition()
    {
        PositionBalloon();
    };

    this.LightUpdatePosition = function LightUpdatePosition(x, y)
    {
        var newX = Math.round(x).toString() + "px";
        var newY = Math.round(y).toString() + "px";
        if (newX !== m_balloon.style.left 
            || newY !== m_balloon.style.top)
        {
            m_balloon.style.left = newX;
            m_balloon.style.top = newY;
        }
        var dataToFrame = {
            command: "update",
            data: {}
        };
        SendToFrame(dataToFrame);
    };

    this.Destroy = function Destroy()
    {
        DestroyBalloon();
    };

    this.IsFocused = function IsFocused()
    {
        if (!m_balloon)
            return false;
        return document.activeElement === m_balloon;
    };

    function OnFrameDataMessage(argument)
    {
        if (browsersApi.runtime.lastError)
        {
            ns.SessionError(browsersApi.runtime.lastError);
            return;
        }
        const message = argument;
        if (message.type === "size")
            OnSizeMessage(message.data);
        else if (message.type === "close")
            OnCloseMessage(message.data);
        else if (message.type === "data")
            OnDataMessage(message.data);
        else if (message.type === "trace")
            ns.SessionLog(message.data);
        else
            ns.SessionError({ message: "Unknown message type", details: "type: " + message.type }, m_balloonId);
    }

    function Init()
    {
        session.InitializePlugin(activatePlugin => { activatePlugin(m_balloonId, OnPing); });
        browsersApi.runtime.onConnect.addListener(OnConnect);
        if (balloonCssPostfix)
            session.GetResource(balloonCssPostfix, OnCssLoad, OnCssLoadError);
    }

    Init();
};
return ns;

})(AvNs);
