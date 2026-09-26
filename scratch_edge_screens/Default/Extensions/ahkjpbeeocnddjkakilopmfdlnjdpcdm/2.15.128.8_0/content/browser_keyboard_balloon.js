(ns =>
{
    ns.BrowserKeyboardBalloon = function BrowserKeyboardBalloon(session, locales, onBalloonDataReceiveHandler)
    {
        const m_balloon = new ns.Balloon2(
            "vk_mac",
            "/vk/browser_keyboard_balloon.html",
            "/vk_mac/balloon.css",
            session,
            GetCoordsCallback,
            OnCloseHandler,
            locales,
            OnDataReceiveHandler
        );

        let m_balloonX = 0;
        let m_balloonY = 0;
        let m_balloonWidth = 0;
        let m_balloonHeight = 0;
        let m_pageMouseX = 0;
        let m_pageMouseY = 0;
        let m_initialOpen = true;
        let m_initialOpenHandler = ns.EmptyFunc;

        function GetCoordsCallback() 
        {
            const coord = { x: m_balloonX, y: m_balloonY };
            return coord;
        }

        function OnCloseHandler(arg)
        {
            if (arg === 0)
                m_balloon.Hide();
        }

        function OnDragStart(mouseX, mouseY) 
        {
            m_pageMouseX = m_balloonX + mouseX;
            m_pageMouseY = m_balloonY + mouseY;

            document.addEventListener("mouseup", OnDragEnd);
            document.addEventListener("mousemove", OnPageMouseMove);
        }

        function OnDragEnd() 
        {
            document.removeEventListener("mouseup", OnDragEnd);
            document.removeEventListener("mousemove", OnPageMouseMove);
        }

        function OnDrag(offsetX, offsetY) 
        {
            m_balloonX += offsetX;
            m_balloonY += offsetY;

            m_balloon.LightUpdatePosition(m_balloonX, m_balloonY);

            m_pageMouseX += offsetX;
            m_pageMouseY += offsetY;
        }

        function OnPageMouseMove(event) 
        {
            m_balloonX += event.clientX - m_pageMouseX;
            m_balloonY += event.clientY - m_pageMouseY;

            m_balloon.LightUpdatePosition(m_balloonX, m_balloonY);

            m_pageMouseX = event.clientX;
            m_pageMouseY = event.clientY;
        }

        function OnDataReceiveHandler(data)
        {
            switch (data.msg)
            {
                case "vk.click":
                    onBalloonDataReceiveHandler(data);
                    break;
                case "vk.dragStart":
                    OnDragStart(data.mouseX, data.mouseY);
                    onBalloonDataReceiveHandler({ key: "dragStart" });
                    break;
                case "vk.drag":
                    OnDrag(data.offsetX, data.offsetY);
                    break;
                case "vk.dragEnd":
                    OnDragEnd();
                    onBalloonDataReceiveHandler({ key: "empty" });
                    break;
                case "vk.created":
                    m_balloonWidth = data.width;
                    m_balloonHeight = data.height;
                    m_initialOpenHandler();
                    break;
                default:
                    break;
            }
        }

        function HasIntersectionsWithWindowBorders()
        {
            return (m_balloonX < 0 || (m_balloonX + m_balloonWidth > window.innerWidth)
                || m_balloonY < 0 || m_balloonY + m_balloonHeight > window.innerHeight);
        }

        function MoveAfterFocusPasswordFieldElement(element)
        {
            const passwordField = element.getBoundingClientRect();
            return () =>
            {
                m_balloonX = passwordField.x + (passwordField.width / 2) - (m_balloonWidth / 2);
                if (m_balloonX < 0)
                    m_balloonX = 0;
                else if (m_balloonX + m_balloonWidth > window.innerWidth)
                    m_balloonX = window.innerWidth - m_balloonWidth;

                m_balloonY = passwordField.y + passwordField.height;
                m_balloon.LightUpdatePosition(m_balloonX, m_balloonY);
            };
        }

        function MoveAfterPopupVkOpenClicked()
        {
            m_balloonX = (window.innerWidth / 2) - (m_balloonWidth / 2);
            m_balloonY = window.innerHeight - m_balloonHeight;
            m_balloon.LightUpdatePosition(m_balloonX, m_balloonY);
        }

        function HasIntersectionWith(element)
        {
            const rect = element.getBoundingClientRect();
            return !(m_balloonX > rect.right || (m_balloonX + m_balloonWidth < rect.x)
                || m_balloonY > rect.bottom || (m_balloonY + m_balloonHeight) < rect.y);
        }

        function OpenWith(handler, element)
        {
            if (!m_initialOpen)
            {
                if (element)
                {
                    if (HasIntersectionWith(element))
                        MoveAfterFocusPasswordFieldElement(element)();
                }
                else if (HasIntersectionsWithWindowBorders())
                {
                    MoveAfterPopupVkOpenClicked();
                }
            }
            else
            {
                m_initialOpenHandler = handler;
                m_initialOpen = false;
            }
            m_balloon.Show("", {});
        }

        this.OnFocus = element =>
        {
            OpenWith(MoveAfterFocusPasswordFieldElement(element), element);
        };

        this.Show = () => { OpenWith(MoveAfterPopupVkOpenClicked, null); };

        this.Hide = () => { m_balloon.Hide(); };
    };

})(AvNs);
