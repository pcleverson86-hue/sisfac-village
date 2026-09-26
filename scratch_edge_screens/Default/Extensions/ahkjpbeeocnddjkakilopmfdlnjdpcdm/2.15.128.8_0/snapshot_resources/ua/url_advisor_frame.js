function ConvertCategory(category, locales) 
{
    "use strict";
    return locales["CAT_" + category];
}

var m_verdictTagElements = [];
var PoliceDecisionCategory = 21;
var PirateSitesCategory = 201;

function ConvertThreat(threat, locales)
{
    "use strict";
    var threatTypes = [
        { name: "Unknown", bit: -1 },
        { name: locales["PhishingName"], bit: 62 },
        { name: locales["MalwareName"], bit: 63 }
    ];
    return threatTypes[threat].name;
}

function AppendChildElementWithText(document, nodeType, parent, text, className) 
{
    "use strict";
    var span = document.createElement(nodeType);
    span.className = className;
    span.appendChild(document.createTextNode(text));
    parent.appendChild(span);
    m_verdictTagElements.push(span);
}

function AddPoliceDecisionTag(document, parent, text, className, locales) 
{
    "use strict";
    var div = document.createElement("div");
    div.className = "kl_police_decision kl_police_decision-Image_custom";
    var policeLink = document.createElement("a");
    policeLink.href = typeof UrlAdvisorLinkPoliceDecision !== "undefined" ? UrlAdvisorLinkPoliceDecision : locales["UrlAdvisorLinkPoliceDecision"];
    policeLink.target = "_blank";
    policeLink.className = "link-foreground_custom";
    div.appendChild(policeLink);
    var span = document.createElement("span");
    span.className = className;
    span.appendChild(document.createTextNode(text));
    policeLink.appendChild(span);
    parent.appendChild(div);
    m_verdictTagElements.push(div);
}

function AddTagsFromList(parentElement, list, converter, document, locales) 
{
    "use strict";
    if (!list)
        return;
    for (var i = 0, count = list.length; i < count; ++i) 
    {
        if (list[i] !== PoliceDecisionCategory && list[i] !== PirateSitesCategory)
            AppendChildElementWithText(document, "span", parentElement, converter(list[i], locales), "kl_tag kl_tag-Image_custom kl_tag-border_custom");
        else
            AddPoliceDecisionTag(document, parentElement, converter(list[i], locales), "kl_tag kl_tag-Image_custom kl_tag-border_custom", locales);
    }
}

function AddVerdictTags(document, verdict, locales)
{
    "use strict";
    var mainDiv = document.getElementById("TagBlockAdditionalStyle");
    if ((!verdict.categories || verdict.categories.length === 0) && (!verdict.threats || verdict.threats.length === 0)) 
    {
        mainDiv.className = "empty_tags";
        return;
    }

    mainDiv.className = "";

    var tagDivs = document.getElementsByClassName("tag_block");

    for (var i = 0; i < tagDivs.length; ++i)
    {
        AddTagsFromList(tagDivs[i], verdict.categories, ConvertCategory, document, locales);
        AddTagsFromList(tagDivs[i], verdict.threats, ConvertThreat, document, locales);
    }
}

function RemoveVerdictTags()
{
    "use strict";
    for (var i = 0; i < m_verdictTagElements.length; i++)
        m_verdictTagElements[i].parentElement.removeChild(m_verdictTagElements[i]);

    m_verdictTagElements = [];
}

function OnGetData(data) 
{
    "use strict";
    LocalizeElementByClassName("target_url", data.verdict.urlUserFriendly || data.verdict.url);
    RemoveVerdictTags();
    AddVerdictTags(document, data.verdict, data.locales);
}

window.FrameObject.onInitData = OnGetData;
window.FrameObject.onGetData = OnGetData;

window.FrameObject.onLocalize = function onLocalize(locales) 
{
    "use strict";
    LocalizeElement("greenHead", locales["UrlAdvisorBalloonHeaderGood"]);
    LocalizeElement("greyHead", locales["UrlAdvisorBalloonHeaderSuspicious"]);
    LocalizeElement("redHead", locales["UrlAdvisorBalloonHeaderDanger"]);
    LocalizeElement("yellowHead", locales["UrlAdvisorBalloonHeaderWmuf"]);
    LocalizeElement("orangeHead", locales["UrlAdvisorBalloonHeaderCompromised"]);
    LocalizeElement("yellowShopsHead", locales["UrlAdvisorBalloonHeaderShop"]);

    LocalizeElement("greenBody", locales["UrlAdvisorSetLocalContentOnlineGood"]);
    LocalizeElement("greyBody", locales["UrlAdvisorSetLocalContentOnlineSuspicious"]);
    LocalizeElement("redBody", locales["UrlAdvisorSetLocalContentOnlineDanger"]);
    LocalizeElement("yellowBody", locales["UrlAdvisorSetLocalContentOnlineWmuf"]);
    LocalizeElement("orangeBody", locales["UrlAdvisorSetLocalContentOnlineCompromised"]);
    LocalizeElement("yellowShopsBody", locales["UrlAdvisorSetLocalContentOnlineShop"]);
};

function OnMouseOut(mouseArgs)
{
    "use strict";
    var relatedTarget = mouseArgs.relatedTarget || mouseArgs.toElement;
    if (!relatedTarget)
        SendClose(0);
}

AddEventListener(window, "load", function OnLoad() 
{
    "use strict";
    var m_balloonElement = document.getElementById("urlAdvisorBalloonBody");
    AddEventListener(m_balloonElement, "mouseout", OnMouseOut);
});
