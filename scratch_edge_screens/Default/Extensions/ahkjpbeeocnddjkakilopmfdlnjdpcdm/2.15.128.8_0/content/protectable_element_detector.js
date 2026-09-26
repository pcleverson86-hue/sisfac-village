(ns =>
{

function Includes(list, text)
{
    for (const elem of list)
    {
        if (elem === text)
            return true;
    }
    return false;
}

ns.ProtectableElementDetector = function ProtectableElementDetector(protectMode)
{
    const m_typesForbidden = ["hidden", "submit", "radio", "checkbox", "button", "image", "number", "tel"];
    const m_protectMode = protectMode;

    this.Test = element =>
    {
        if (m_protectMode < 2 || m_protectMode > 3)
            return false;
        let elementType = element.getAttribute("type");
        elementType = elementType && elementType.toLowerCase();
        if (m_protectMode === 2)
        {
            if (elementType !== "password")
                return false;
        }
        else if (Includes(m_typesForbidden, elementType))
        {
            return false;
        }
        if (GetComputedStyle(element, "display") === "none")
            return false;
        const maxLength = parseInt(element.getAttribute("maxlength"), 10);
        return typeof maxLength === "number" && maxLength <= 3 ? false : !element.readOnly;
    };

    function GetComputedStyle(element, property)
    {
        let value = "";
        if (element.currentStyle)
        {
            value = element.currentStyle[property];
        }
        else
        {
            const styles = window.getComputedStyle(element, "");
            if (styles)
                value = styles.getPropertyValue(property);
        }
        return typeof value !== "string" ? "" : value.toLowerCase();
    }
};

const vkAttributeName = `kl_vk.original_type_${ns.GetCurrentTime()}`;

ns.ProtectableElementDetector.ChangeTypeIfNeeded = element =>
{
    const m_typesToChange = ["email"];
    const originalType = element.getAttribute("type");
    if (Includes(m_typesToChange, originalType))
    {
        element.setAttribute(vkAttributeName, originalType);
        element.setAttribute("type", "text");
    }
};

ns.ProtectableElementDetector.RestoreTypeIfNeeded = element =>
{
    if (element.hasAttribute(vkAttributeName))
    {
        element.setAttribute("type", element.getAttribute(vkAttributeName));
        element.removeAttribute(vkAttributeName);
    }
};

})(AvNs);
