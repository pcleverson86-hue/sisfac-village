(ns =>
{
ns.FocusChangeObserver = function FocusChangeObserver(focusHandler, blurHandler, settingsChangedHandler, selectors)
{
    const m_pluginId = "vk";
    let m_focusedElement = null;

    function tryToGetFocusedInput()
    {
        const element = document.activeElement;
        return (document.hasFocus() && isFocusAllowedElement(element)) ? element : null;
    }

    function isFocusAllowedElement(element)
    {
        return element && selectors.some(selector =>
            {
                if (selector.tagName && selector.types)
                {
                    return ns.IsStringEqualIgnoreCase(selector.tagName, element.tagName)
                        && (element.type ? selector.types.includes(element.type.toLowerCase()) : true);
                }
                else if (selector.tagName)
                {
                    return ns.IsStringEqualIgnoreCase(selector.tagName, element.tagName);
                }
                return element.matches && element.matches(selector);
            });
    }

    function onBlur()
    {
        try
        {
            if (m_focusedElement)
            {
                const element = m_focusedElement;
                m_focusedElement = null;
                blurHandler(element);
            }
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function onFocus(event)
    {
        try
        {
            const element = event.target;
            if (isFocusAllowedElement(element))
            {
                m_focusedElement = element;
                focusHandler(element);
            }
            else if (element.shadowRoot)
            {
                for (const selector of selectors)
                {
                    for (const elementType of selector.types)
                    {
                        const innerElement = element.shadowRoot.querySelector(`${selector.tagName}[type=${elementType}]`);
                        if (innerElement)
                        {
                            m_focusedElement = innerElement;
                            focusHandler(innerElement);
                            return;
                        }
                    }
                }
            }
        }
        catch (e)
        {
            ns.SessionError(e, m_pluginId);
        }
    }

    function Initialize()
    {
        m_focusedElement = tryToGetFocusedInput();

        ns.AddRemovableEventListener(document, "focus", onFocus);
        ns.AddRemovableEventListener(document, "blur", onBlur);

        if (m_focusedElement)
            focusHandler(m_focusedElement);
    }

    Initialize();

    this.settingsChanged = () =>
    {
        if (m_focusedElement)
            settingsChangedHandler(m_focusedElement);
    };

    this.unbind = () =>
    {
        ns.RemoveEventListener(document, "focus", onFocus);
        ns.RemoveEventListener(document, "blur", onBlur);
        if (m_focusedElement)
        {
            blurHandler(m_focusedElement);
            m_focusedElement = null;
        }
    };
};
})(AvNs);
