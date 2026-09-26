var m_needShowAdditionalMenu = false;
var m_mainDiv = null;

function AddOnClickHandler(className, handler)
{
    "use strict";
    var element = document.getElementsByClassName(className)[0];
    if (element)
        AddEventListener(element, "click", handler);
}

function AdditionalMenuUpdate()
{
    "use strict";
    if (m_mainDiv)
        m_mainDiv.className = m_needShowAdditionalMenu ? "show_hide_menu" : "";
}

function OnClickCloseButton()
{
    "use strict";
    SendClose(1);
}

function OnShowSubmenu()
{
    "use strict";
    m_mainDiv = document.getElementById("mainDiv");
    m_needShowAdditionalMenu = !m_needShowAdditionalMenu;
    AdditionalMenuUpdate();
}

function OnBalloonClick()
{
    "use strict";
    m_needShowAdditionalMenu = false;
    SendData({ isNeedRestoreFocus: true });
    AdditionalMenuUpdate();
}

function OnClickSkipNotification()
{
    "use strict";
    SendClose(2);
}

function OnClickInstallButton()
{
    "use strict";
    SendClose(3);
}

function OnGetData(data)
{
    "use strict";
    var className = "";

    var passwordStrength = data.strength;
    if (passwordStrength)
    {
        var strengthName = "";
        switch (passwordStrength.quality)
        {
            case 0:
            case 1:  strengthName = "strong"; break;
            case 2:  strengthName = "average"; break;
            default: strengthName = "weak"; break;
        }
        className = "popup_" + strengthName;
        if (passwordStrength.quality > 1)
        {
            className += " " + strengthName + "-reason-";
            var reason = passwordStrength.reasons.length > 0 ? passwordStrength.reasons[0].reason : 0;
            switch (reason)
            {
                case 0:
                case 4: className += "keyboard"; break;
                case 1: className += "frequent-words"; break;
                case 2: className += "length"; break;
                case 3: className += "alternation"; break;
                default: break;
            }
        }
    }

    var arrowClassName = "arrow-show-" + data.arrow;

    document.body.className += " " + className + " " + arrowClassName;
}

window.FrameObject.onLocalize = function onLocalize(locales)
{
    "use strict";
    LocalizeElement("verdictTitle", locales["PasswordControlVerdictTitle"]);
    LocalizeElement("verdictStrong", locales["PasswordControlVerdictStrong"]);
    LocalizeElement("verdictAverage", locales["PasswordControlVerdictAverage"]);
    LocalizeElement("verdictWeak", locales["PasswordControlVerdictWeak"]);
    LocalizeElement("verdictTitleEmpty", locales["PasswordControlEmptyHeader"]);
    LocalizeElement("skipNotification", locales["PasswordControlSkipNotification"]);
    LocalizeElement("recomendations", locales["PasswordControlRecommendations"]);
    LocalizeElement("recomendationLength", locales["PasswordControlRecommendationLength"]);
    LocalizeElement("recomendationKeyboard", locales["PasswordControlRecommendationKeyboard"]);
    LocalizeElement("recomendationFrequentWords", locales["PasswordControlRecommendationFrequentWords"]);
    LocalizeElement("recomendationAlternation", locales["PasswordControlRecommendationAlternation"]);
    LocalizeElement("recomendation", locales["PasswordControlRecomendation"]);
};

window.FrameObject.onInitData = OnGetData;
window.FrameObject.onGetData = OnGetData;

AddEventListener(window, "load", function OnLoad()
    {
        "use strict";
        AddOnClickHandler("popup-header__close-button", OnClickCloseButton);
        AddOnClickHandler("popup-header__hide-button", OnShowSubmenu);
        AddOnClickHandler("popup-header__hide-menu", OnClickSkipNotification);
        AddOnClickHandler("button", OnClickInstallButton);
        m_mainDiv = document.getElementById("mainDiv");
        AddOnClickHandler("main-div", OnBalloonClick);
    });
