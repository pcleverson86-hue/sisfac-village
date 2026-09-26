(function PasswordControlBalloonMain(ns)
{

ns.PasswordControlBalloon = function PasswordControlBalloon(settings, locales, callFunction, session)
{
    var m_pluginId = "pc";

    var m_balloon = null;
    var m_focusedElement = null;
    var m_lastChange = null;
    var m_hideTimer = null;
    var m_displayBalloon = false;
    var m_currentVerdictClassName = "";
    var m_currentPasswordStrength = null;
    var m_currentArrowClassName = "left";
    var m_restoreFocusTimeout = null;

    var m_frameInfo = { fromFrame: false };

    var m_focusEventName = "";
    var m_blurEventName = "";
    var m_focusTimeOut = null;

    var m_domParser = ns.GetDomParser(session);
    var m_passwordInputObserver = ns.GetDomChangeObserver("input", m_pluginId);

    var m_delaySkipFocusEvent = false;
    var m_delayTimeout = 1000;

    if (window.addEventListener)
    {
        m_focusEventName = "focus";
        m_blurEventName = "blur";
    }
    else
    {
        m_focusEventName = "focusin";
        m_blurEventName = "focusout";
    }

    function OnGetDataCallback(data)
    {
        if (data.isNeedRestoreFocus && m_focusedElement)
        {
            ns.SessionLog("Restore focus on password");
            ns.ClearTimeout(m_hideTimer);
            m_focusedElement.focus();
        }
    }

    function Unsubscribe(element, onInput, onBlur)
    {
        ns.SessionLog("Unsubscribe on input and blur events");
        ns.RemoveEventListener(element, "input", onInput);
        ns.RemoveEventListener(element, "keyup", onInput);
        ns.RemoveEventListener(element, "keydown", onInput);
        ns.RemoveEventListener(element, m_blurEventName, onBlur);
    }

    function GeneratePopupAttributes(password)
    {
        if (!password)
        {
            m_currentVerdictClassName = "popup_empty";
            m_currentPasswordStrength = null;
        }
        else
        {
            m_currentVerdictClassName = "";

            var holder = null;
            if (window.JSON)
            {
                holder = JSON.parse;
                JSON.parse = ns.JSONParse;
            }
            m_currentPasswordStrength = ns.CheckPasswordStrength(password);
            if (window.JSON)
                JSON.parse = holder;
        }
    }

    function GetBalloonData()
    {
        return { strength: m_currentPasswordStrength, arrow: m_currentArrowClassName };
    }

    function UpdateBalloon()
    {
        if (!m_balloon)
            return;
        m_balloon.Update(m_currentVerdictClassName, GetBalloonData());
    }

    function GetTopForLeftOrRightPosition(elementRect)
    {
        return elementRect.top - 80 + ((elementRect.bottom - elementRect.top) / 2);
    }
    function GetLeftForTopOrBottomPosition(elementRect)
    {
        return elementRect.left - 13;
    }

    function GetCoord(balloonSize)
    {
        var coord = { x: 0, y: 0 };

        var elementRect = {};
        if (m_frameInfo.fromFrame)
        {
            elementRect = m_frameInfo.coord;
        }
        else
        {
            if (!m_focusedElement)
                return coord;
            elementRect = m_focusedElement.getBoundingClientRect();
        }
        var clientHeight = ns.GetPageHeight();
        var clientWidth = ns.GetPageWidth();

        var newArrowClassName = "";
        if ((elementRect.right + balloonSize.width <= clientWidth) && GetTopForLeftOrRightPosition(elementRect) >= 0)
        {
            newArrowClassName = "left";
            coord.x = elementRect.right;
            coord.y = GetTopForLeftOrRightPosition(elementRect);
        }
        else if ((elementRect.left - balloonSize.width >= 0) && GetTopForLeftOrRightPosition(elementRect) >= 0)
        {
            newArrowClassName = "right";
            coord.x = elementRect.left - balloonSize.width;
            coord.y = GetTopForLeftOrRightPosition(elementRect);
        }
        else if (elementRect.bottom + balloonSize.height < clientHeight)
        {
            newArrowClassName = "top";
            coord.x = GetLeftForTopOrBottomPosition(elementRect);
            coord.y = elementRect.bottom;
        }
        else if (elementRect.top - balloonSize.height > 0)
        {
            newArrowClassName = "bottom";
            coord.x = GetLeftForTopOrBottomPosition(elementRect);
            coord.y = elementRect.top - balloonSize.height;
        }
        else
        {
            newArrowClassName = "top";
            coord.x = elementRect.left - 13;
            coord.y = elementRect.bottom;
        }

        if (newArrowClassName !== m_currentArrowClassName)
        {
            m_currentArrowClassName = newArrowClassName;
            ns.SetTimeout(UpdateBalloon, 0, m_pluginId);
        }

        var scroll = ns.GetPageScroll();
        coord.x += scroll.left;
        coord.y += scroll.top;

        return coord;
    }

    function ShowBalloonImpl(password)
    {
        if (!m_balloon)
        {
            ns.SessionLog("Balloon is undefined, not possible to show it.");
            return;
        }

        GeneratePopupAttributes(password);
        if (!m_displayBalloon)
        {
            callFunction("pc.Tooltip");
            m_displayBalloon = true;
            m_balloon.Show(m_currentVerdictClassName, GetBalloonData());
        }
        else
        {
            UpdateBalloon();
        }
    }

    function OnPasswordFocused(password)
    {
        ns.SessionLog("Clear restore focus timeout");
        ns.ClearTimeout(m_restoreFocusTimeout);
        ns.ClearTimeout(m_hideTimer);
        ShowBalloonImpl(password);
        if (m_balloon)
            m_balloon.UpdatePosition();
    }

    this.ShowBalloon = function ShowBalloon(obj)
    {
        if (!ns.IsTopLevel)
            return;
        m_frameInfo.fromFrame = true;
        m_frameInfo.coord = {};

        m_frameInfo.coord.top = obj.top;
        m_frameInfo.coord.bottom = obj.bottom;
        m_frameInfo.coord.left = obj.left;
        m_frameInfo.coord.right = obj.right;

        if (m_frameInfo.frameElement)
        {
            var r = m_frameInfo.frameElement.getBoundingClientRect();

            m_frameInfo.coord.top += r.top;
            m_frameInfo.coord.bottom += r.top;
            m_frameInfo.coord.left += r.left;
            m_frameInfo.coord.right += r.left;
        }

        OnPasswordFocused(obj.password);
    };

    function HideBalloonImpl()
    {
        if (m_balloon)
            m_balloon.Hide();
        m_displayBalloon = false;
    }

    function OnHideBalloon()
    {
        if (ns.IsTopLevel)
            HideBalloonImpl();
        else
            callFunction("pc.NeedToHideBalloon");
    }

    this.HideBalloon = function HideBalloon()
    {
        if (!ns.IsTopLevel)
            return;

        m_frameInfo.fromFrame = true;
        HideBalloonImpl();
    };

    function OnInput()
    {
        try
        {
            if (!m_focusedElement)
                return;
            if (m_lastChange === m_focusedElement.value)
                return;

            if (ns.IsTopLevel)
            {
                ShowBalloonImpl(m_focusedElement.value);
            }
            else
            {
                var r = m_focusedElement.getBoundingClientRect();
                callFunction("pc.NeedToShowBalloon",
                { top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right), left: Math.round(r.left), password: m_focusedElement.value });
            }

            m_lastChange = m_focusedElement.value;
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function OnBlur()
    {
        try
        {
            ns.ClearTimeout(m_focusTimeOut);

            if (m_focusedElement)
            {
                ns.ClearTimeout(m_hideTimer);
                m_hideTimer = ns.SetTimeout(function TimerCallback() { OnHideBalloon(); }, 700, m_pluginId);

                Unsubscribe(m_focusedElement, OnInput, OnBlur);
                m_lastChange = null;
            }
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function AddRemovableEventListener(element)
    {
        m_focusedElement = element;

        ns.AddRemovableEventListener(element, m_blurEventName, OnBlur);
        ns.AddRemovableEventListener(element, "input", OnInput);

        ns.AddRemovableEventListener(element, "keyup", OnInput);
        ns.AddRemovableEventListener(element, "keydown", OnInput);
    }

    function IsPasswordInputCallback(result, passwords, element)
    {
        if (result === 0 && element && passwords)
        {
            for (var i = 0; i < passwords.length; i++)
            {
                if (element === document.querySelector(passwords[i]))
                {
                    if (ns.IsTopLevel)
                    {
                        m_frameInfo.fromFrame = false;
                        return true;
                    }
                    var r = element.getBoundingClientRect();
                    AddRemovableEventListener(element);
                    callFunction("pc.NeedToShowBalloon",
                    { top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right), left: Math.round(r.left), password: m_focusedElement.value });
                    return false;
                }
            }
        }
        else
        {
            ns.SessionLog("password input callback get result: " + result + " with passwords size: " + passwords.length);
        }

        return false;
    }

    function CheckSelectorCallback(element)
    {
        return function CheckSelector(result, passwords) 
        {
            if (IsPasswordInputCallback(result, passwords, element))
            {
                ns.SessionLog("Focused on password field");
                AddRemovableEventListener(element);
                OnPasswordFocused(m_focusedElement.value);
            }
            else
            {
                ns.SessionLog("Focused on not password field with type: " + element.type);
            }
        };
    }

    function ShowBalloonOnPasswordInput(element)
    {
        m_domParser.GetNewPasswordSelectors(CheckSelectorCallback(element));
    }

    function OnFocus(evt)
    {
        if (m_delaySkipFocusEvent)
        {
            ns.SessionLog("Skip focus event after click button in balloon");
            return;
        }

        var element = evt.target || evt.srcElement;

        m_focusTimeOut = ns.SetTimeout(function TimerCallback()
        {
            if (!element)
                ns.SessionLog("Skip focus event for null element");
            else if (element.type === "password")   
                ShowBalloonOnPasswordInput(element);
            else
                ns.SessionLog("Skip focus event for element with type: " + element.type);
        }, 0, m_pluginId);
    }

    function OnCloseButton()
    {
        var element = m_focusedElement;
        m_focusedElement = null;
        m_lastChange = null;
        if (element)
        {
            Unsubscribe(element, OnInput, OnBlur);
            m_restoreFocusTimeout = ns.SetTimeout(function TimerCallback()
                {
                    element.focus();
                    ns.SessionLog("Restore focus for element with type: " + element.type);
                }, 1000, m_pluginId);
            element.focus();
            ns.SessionLog("Restore focus before click close button");
        }
        ns.SessionLog("Click close button");
    }

    function OnInstallButton()
    {
        OnCloseButton();
        ns.RemoveEventListener(document, m_focusEventName, OnFocus);
        ns.SessionLog("Unsubscribed from OnFocus event");
        callFunction("pc.Download");
    }

    function DisableImpl()
    {
        var focusedElement = m_focusedElement;
        if (m_balloon)
        {
            m_balloon.Hide();
            m_balloon = null;
        }
        if (focusedElement)
            Unsubscribe(focusedElement, OnInput, OnBlur);
        ns.RemoveEventListener(document, m_focusEventName, OnFocus);
        ns.SessionLog("Disabling password control. Unsubscribed from OnFocus event");
    }

    function OnSkipNotification()
    {
        DisableImpl();
        callFunction("pc.SkipNotification");
    }

    this.Disable = function Disable()
    {
        DisableImpl();
    };

    function OnCloseHandler(closeAction)
    {
        m_displayBalloon = false;
        m_delaySkipFocusEvent = true;

        switch (closeAction)
        {
        case 1:
            OnCloseButton();
            break;
        case 2:
            OnSkipNotification();
            break;
        case 3:
            OnInstallButton();
            break;
        default:
            ns.SessionError({ message: "Unknown close action", details: "action: " + closeAction }, m_pluginId);
            break;
        }

        ns.ClearTimeout(m_focusTimeOut);
        ns.SetTimeout(function TimerCallback() { m_delaySkipFocusEvent = false; }, m_delayTimeout, m_pluginId);
    }

    function OnMouseOver(evt)
    {
        var element = evt.target || evt.srcElement;
        if (!ns.IsEqualNodeName(element, "iframe"))
            return;

        m_frameInfo.frameElement = element;
    }

    function ResetDomParser()
    {
        m_domParser.Reset();
    }

    ns.AddRemovableEventListener(document, m_focusEventName, OnFocus);
    ns.SessionLog("Subscribed for OnFocus event");
    m_passwordInputObserver.Start(ResetDomParser);
    if (ns.IsTopLevel)
    {
        m_balloon = new ns.Balloon2(m_pluginId, "/pc/password_control_balloon.html", "/pc/tooltip.css", session, GetCoord, OnCloseHandler, locales, OnGetDataCallback);
        ns.AddEventListener(document, "mouseover", OnMouseOver, m_pluginId);
    }
};

})(AvNs || {});
