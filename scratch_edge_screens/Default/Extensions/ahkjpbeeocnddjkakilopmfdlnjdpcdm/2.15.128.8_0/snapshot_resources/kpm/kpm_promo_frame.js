function AddOnClickHandler(className, handler) 
{
    "use strict";
    var element = document.querySelector(className);
    if (element)
        AddEventListener(element, "click", handler);
}

function OnClickCloseButton() 
{
    "use strict";
    SendClose(1);
}

function OnClickInstallButton()
{
    "use strict";
    SendClose(2);
}

function OnClickSkipNotification()
{
    "use strict";
    SendClose(3);
}

AddEventListener(window, "load", function OnLoad() 
    {
        "use strict";
        AddOnClickHandler("#close_button", OnClickCloseButton);
        AddOnClickHandler("#install_button", OnClickInstallButton);
        AddOnClickHandler("#ignore_button", OnClickSkipNotification);
    });

window.FrameObject.onLocalize = function onLocalize(locales)
{
    "use strict";
    LocalizeElement("header_text", locales["KpmPromoHeaderTitle"]);
    LocalizeElement("message_title", locales["KpmPromoMessageTitle"]);
    LocalizeElement("message_text", locales["KpmPromoMessageText"]);
    LocalizeElement("install_button", locales["KpmPromoInstallButton"]);
    LocalizeElement("ignore_button", locales["KpmPromoIgnoreButton"]);
};
