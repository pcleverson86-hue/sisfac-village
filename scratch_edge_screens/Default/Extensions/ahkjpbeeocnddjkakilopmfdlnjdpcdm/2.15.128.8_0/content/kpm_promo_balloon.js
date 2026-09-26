(function KpmBalloonMain(ns) 
{
    ns.KpmPromoBalloon = function KpmPromoBalloon(session, locales, callFunction) 
    {
        const m_balloonStyle = "balloon";
        var m_balloon = null;
        var m_balloonWasShowed = false;
        var m_observer = null;
        var m_currentElement = null;

        var m_frameInfo = { fromFrame: false };

        var m_domParser = ns.GetDomParser(session);
        var m_onKeyDown = null;
        var m_onChange = null;
        var m_pluginId = "kpm";

        function GetCoord(balloonSize)
        {
            var coord = { x: 0, y: 0 };

            if (!m_currentElement && !m_frameInfo.fromFrame)
                return coord;

            var elementRect = {};
            if (m_frameInfo.fromFrame)
                elementRect = m_frameInfo.coord;
            else
                elementRect = m_currentElement.getBoundingClientRect();

            var clientWidth = ns.GetPageWidth();

            coord.x = (elementRect.right + balloonSize.width <= clientWidth) ? elementRect.right : elementRect.left - balloonSize.width;
            coord.y = elementRect.top + ((elementRect.bottom - elementRect.top) / 2) - (balloonSize.height / 2);

            if (coord.x < 0)
                coord.x = 0;
            if (coord.y < 0)
                coord.y = 0;

            if (coord.x + balloonSize.width > clientWidth)
                coord.x = clientWidth - balloonSize.width;

            var scroll = ns.GetPageScroll();
            coord.x += scroll.left;
            coord.y += scroll.top;

            return coord;
        }

        function GetCoordsCallback(balloonSize)
        {
            return GetCoord(balloonSize);
        }

        function ShowBalloonImpl()
        {
            if (!m_balloon)
            {
                ns.SessionLog("Balloon is undefined, not possible to show it.");
                return;
            }

            ns.SessionLog("Kpm promo show ballon. Is showed: " + m_balloonWasShowed);
            if (!m_balloonWasShowed)
            {
                ns.RemoveEventListener(document, "keydown", m_onKeyDown);
                ns.RemoveEventListener(document, "change", m_onChange);
                m_balloonWasShowed = true;
                if (ns.IsTopLevel)
                {
                    m_frameInfo.fromFrame = false;
                    m_balloon.Show(m_balloonStyle);
                    callFunction("kpm.onTooltipShowed");
                }
            }

            if (ns.IsTopLevel)
            {
                m_frameInfo.fromFrame = false;
                m_balloon.Show(m_balloonStyle);
                m_balloon.UpdatePosition();
            }
            else
            {
                var r = m_currentElement.getBoundingClientRect();
                callFunction("kpm.NeedToShowTooltip", { top: r.top, bottom: r.bottom, right: r.right, left: r.left });
                m_balloonWasShowed = true;
            }
        }

        function ProcessSelectors(selectors, currentElement)
        {
            selectors.forEach(function forEachCallback(selector)
            {
                var element = document.querySelector(selector);
                ns.SessionLog("Kpm promo get element by selector: " + selector + " is current element: " + (element && element === currentElement));

                if (element && element === currentElement)
                {
                    m_currentElement = element;
                    ShowBalloonImpl();
                }
            });
        }

        function ShowBalloonIfNeed(result, selectors, currentElement)
        {
            ns.SessionLog("Kpm promo show ballon callback called: " + selectors);
            if (result)
                return;

            if (m_currentElement && m_currentElement.offsetParent)
            {
                if (ns.IsElementVisibleCheckApplicable() && !ns.IsElementVisible(m_currentElement))
                    ProcessSelectors(selectors, currentElement);
                else
                    ShowBalloonImpl();

                return;
            }

            ProcessSelectors(selectors, currentElement);
        }

        function ProcessForField(field)
        {
            var ShowBalloonIfNeedForField = function ShowBalloonIfNeedForField(result, selectors)
            {
                ShowBalloonIfNeed(result, selectors, field);
            };
            m_domParser.GetLoginSelectors(ShowBalloonIfNeedForField);
            m_domParser.GetPasswordSelectors(ShowBalloonIfNeedForField);
            m_domParser.GetNewPasswordSelectors(ShowBalloonIfNeedForField);
        }

        function OnKeyDown(evt)
        {
            try
            {
                if (m_balloonWasShowed && ns.IsTopLevel)
                {
                    ns.SessionLog("Balloon was already shown");
                    return;
                }
                if (evt && evt.target && ns.IsStringEqualIgnoreCase(evt.target.tagName, "input"))
                    ProcessForField(evt.target);
                else
                    ns.SessionLog("No input field");
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function OnChange(evt)
        {
            try
            {
                if (evt && evt.target && ns.IsStringEqualIgnoreCase(evt.target.tagName, "input") && ns.IsStringEqualIgnoreCase(evt.target.type, "password"))
                {
                    if (evt.target.value !== "")
                        ProcessForField(evt.target);
                }
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function CheckIframe(evt)
        {
            if (!ns.IsTopLevel)
                return;

            var element = evt.target || evt.srcElement;
            if (!ns.IsEqualNodeName(element, "iframe"))
                return;

            m_frameInfo.frameElement = element;
        }

        function OnMouseOver(evt)
        {
            try
            {
                CheckIframe(evt);
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        this.ShowBalloon = function ShowBalloon(obj)
        {
            if (!ns.IsTopLevel || !m_frameInfo.frameElement)
                return;

            m_frameInfo.fromFrame = true;
            m_frameInfo.coord = {};

            var r = m_frameInfo.frameElement.getBoundingClientRect();

            m_frameInfo.coord.top = obj.top + r.top;
            m_frameInfo.coord.bottom = obj.bottom + r.top;
            m_frameInfo.coord.left = obj.left + r.left;
            m_frameInfo.coord.right = obj.right + r.left;

            ShowBalloonImpl();
        };

        this.OnSessionShutdown = function OnSessionShutdown()
        {
            if (m_observer)
                m_observer.Stop();
        };

        function OnFocus(evt)
        {
            try
            {
                CheckIframe(evt);

                if (!m_balloonWasShowed)
                    return;
                ProcessForField(evt.target);
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function OnResize()
        {
            try
            {
                if (!m_balloonWasShowed || !m_currentElement)
                    return;
                ShowBalloonImpl();
            }
            catch (e)
            {
                ns.SessionError(e, m_pluginId);
            }
        }

        function DestroyBalloon()
        {
            m_balloon.Destroy();
        }

        function OnCloseHandler(arg)
        {
            if (arg === 1)
                callFunction("kpm.onTooltipClosed");
            if (arg === 2)
                callFunction("kpm.onInstallPluginClicked");
            if (arg === 3)
                callFunction("kpm.onSkipNotificationsClicked");

            ns.RemoveEventListener(document, "focus", OnFocus);
            ns.RemoveEventListener(window, "resize", OnResize);
            if (!m_balloonWasShowed)
            {
                ns.RemoveEventListener(document, "keydown", OnKeyDown);
                ns.RemoveEventListener(document, "change", OnChange);
            }       
            if (ns.IsTopLevel)
                ns.RemoveEventListener(document, "mouseover", OnMouseOver);


            if (m_observer)
                m_observer.Stop();
            m_balloon.Hide();
            ns.SetTimeout(DestroyBalloon, 200, m_pluginId);
        }

        m_onKeyDown = OnKeyDown;
        m_onChange = OnChange;
        m_balloon = ns.IsTopLevel
            ? new ns.Balloon2(m_pluginId, "/kpm/kpm_promo_balloon.html", "/kpm/tooltip.css", session, GetCoordsCallback, OnCloseHandler, locales, null)
            : null;

        ns.AddRemovableEventListener(document, "focus", OnFocus);
        ns.AddRemovableEventListener(window, "resize", OnResize);
        if (ns.IsTopLevel)
            ns.AddRemovableEventListener(document, "mouseover", OnMouseOver);

        ns.AddRemovableEventListener(document, "change", OnChange);
        ns.AddRemovableEventListener(document, "keydown", OnKeyDown);

        function CheckFieldsByCSS(selector, checkFn)
        {
            try
            {
                var fields = ns.DocumentQuerySelectorAll(selector);
                for (let field of fields)
                {
                    if (checkFn(field))
                        ProcessForField(field);
                }
            }
            catch (e)
            {
                return false;
            }
            return true;
        }

        function CheckFields()
        {
            if (m_balloonWasShowed && m_currentElement && !m_currentElement.offsetParent && m_balloon)
            {
                m_currentElement = null;
                m_balloon.Hide();
            }
            if (!m_balloonWasShowed)
            {
                if (!CheckFieldsByCSS("input:-webkit-autofill", function checker() { return true; }))
                    CheckFieldsByCSS("input[type='password']", function checker(field) { return field.value !== ""; });
            }
            else
            {
                ProcessForField(document.activeElement);
            }
        }
        CheckFields();

        m_observer = ns.GetDomChangeObserver("input", m_pluginId);
        m_observer.Start(CheckFields);
    };

})(AvNs || {});
