AddEventListener(window, "load", () =>
    {
        let closeButton = document.getElementById("close");
        if (closeButton)
            AddEventListener(closeButton, "click", OnClickCloseButton);
    }
);

function OnClickCloseButton()
{
    SendClose(1);
}

window.FrameObject.onLocalize = (locales) =>
{
    let tooltipTextDiv = document.getElementById("tooltipText");
    if (tooltipTextDiv)
        tooltipTextDiv.appendChild(document.createTextNode(locales["VkTooltipText"]));
}
