function LogError(message)
{
    console.log(message); 
}

let PhishingUserFeedbackWindow = function PhishingUserFeedbackWindow(settings, locales, report)
{
    let m_webPageLimitInCharactersSize = 0;
    let m_isAreaExpanded = false;

    function OpenInfo()
    {
        ApiCall(browsersApi.runtime.sendMessage)
            .OnError(err => LogError(`ufb.openPhishingInfo failed with error ${err.message}`))
            .Start({ command: "ufb.openPhishingInfo" });

        if (locales["WindowPhfbOpenInfoLink"])
            window.open(locales["WindowPhfbOpenInfoLink"]);
    }

    function SendReport()
    {
        SetDialogView();

        let isLimitExceeded = report.webpage.length > m_webPageLimitInCharactersSize;
        if (isLimitExceeded)
            report.webpage = report.webpage.substr(0, m_webPageLimitInCharactersSize);

        ApiCall(browsersApi.runtime.sendMessage)
            .OnError(err => LogError(`ufb.sendReport failed with error ${err.message}`))
            .Start({ command: "ufb.sendReport", report: report });
    }

    function SetSettings()
    {
        m_webPageLimitInCharactersSize = settings.webPageLimitInKbSize * 1024 / 2;
    }

    function CreateRedirectedSitesText()
    {
        let text = "";
        for (let i = 0; i < report.redirects.length; i++)
        {
            text += report.redirects[i] + "\n";
        }
        return text;
    }

    function ExpandArea()
    {
        if (m_isAreaExpanded === false)
        {
            ChangeClassAttribute("area-web-page-url-not-expanded", "area-web-page-url-expanded");
            ChangeClassAttribute("expand-button-ufb-image-not-expanded", "expand-button-ufb-image-expanded");
            document.getElementById("WindowPhfbExpandButtonText").innerText = locales["WindowPhfbExpandButtonTextAfter"];
            m_isAreaExpanded = true;
        }
        else
        {
            ChangeClassAttribute("area-web-page-url-expanded", "area-web-page-url-not-expanded");
            ChangeClassAttribute("expand-button-ufb-image-expanded", "expand-button-ufb-image-not-expanded");
            document.getElementById("WindowPhfbExpandButtonText").innerText = locales["WindowPhfbExpandButtonTextBefore"];
            m_isAreaExpanded = false;
        }
    }

    function Init()
    {
        window.document.title = locales["PopupWindowPhfbTitle"];
        LocalizeElement("WindowPhfbTitleText", locales);
        LocalizeElement("WindowPhfbInfoText", locales);
        LocalizeElement("WindowPhfbWebsiteTitleText", locales);
        LocalizeElement("WindowPhfbRedirectedSitesTitleText", locales);
        LocalizeElement("WindowPhfbAgreementText", locales);
        LocalizeElement("WindowPhfbReportButtonText", locales);
        LocalizeElement("WindowPhfbThanksText", locales);
        LocalizeElement("WindowPhfbAnalysisText", locales);
        LocalizeElement("WindowPhfbCloseButtonText", locales);
        LocalizeElement("WindowPhfbOpenInfoButtonText", locales);
        Localize(document.getElementById("WindowPhfbExpandButtonText"), locales["WindowPhfbExpandButtonTextBefore"]);

        SetClickHandler("phfbReportButton", SendReport);
        SetClickHandler("phfbExpandButton", ExpandArea);
        SetClickHandler("phfbCloseButton", Close);
        SetClickHandler("WindowPhfbOpenInfoButtonText", OpenInfo);

        SetSettings();

        let redirectedListTextElement = document.getElementById("WindowPhfbRedirectedSitesUrlText");
        redirectedListTextElement.innerText = CreateRedirectedSitesText();
        if (redirectedListTextElement.innerText == "")
            document.getElementById("WindowPhfbSectionRedirected").style.display = "none";

        let websiteUrlTextElement = document.getElementById("WindowPhfbWebsiteUrlText");
        websiteUrlTextElement.innerText = report.url;

        if (websiteUrlTextElement.offsetHeight <= document.getElementById("WindowPhfbWebsiteSectionSite").offsetHeight &&
            redirectedListTextElement.offsetHeight <= document.getElementById("WindowPhfbSectionRedirected").offsetHeight)
            document.getElementById("areaPhfbExpandButton").remove();

        report.type = "ufb.phishing";
    }

    AvNs.RunModule(Init);
};

let BrokenWebpageUserFeedbackWindow = function BrokenWebpageUserFeedbackWindow(settings, locales, report)
{
    let m_webPageLimitInCharactersSize = 0;
    let m_isAreaExpanded = false;

    function SetSettings()
    {
        m_webPageLimitInCharactersSize = settings.webPageLimitInKbSize * 1024 / 2;
        document.getElementById("bwfbTextArea").setAttribute("maxlength", settings.userTextLimitInSymbolsSize);
    }

    function ExpandArea()
    {
        if (m_isAreaExpanded === false)
        {
            ChangeClassAttribute("area-web-page-url-not-expanded", "area-web-page-url-expanded");
            ChangeClassAttribute("expand-button-ufb-image-not-expanded", "expand-button-ufb-image-expanded");
            document.getElementById("WindowBwfbExpandButtonText").innerText = locales["WindowBwfbExpandButtonTextAfter"];
            m_isAreaExpanded = true;
        }
        else
        {
            ChangeClassAttribute("area-web-page-url-expanded", "area-web-page-url-not-expanded");
            ChangeClassAttribute("expand-button-ufb-image-expanded", "expand-button-ufb-image-not-expanded");
            document.getElementById("WindowBwfbExpandButtonText").innerText = locales["WindowBwfbExpandButtonTextBefore"];
            m_isAreaExpanded = false;
        }
    }

    function SendReport()
    {
        SetDialogView();

        report.userText = document.getElementById("bwfbTextArea").value;

        let isLimitExceeded = report.webpage.length > m_webPageLimitInCharactersSize;
        if (isLimitExceeded)
            report.webpage = report.webpage.substr(0, m_webPageLimitInCharactersSize);

        ApiCall(browsersApi.runtime.sendMessage)
            .OnError(err => LogError(`ufb.sendReport failed with error ${err.message}`))
            .Start({ command: "ufb.sendReport", report: report });
    }

    function Init()
    {
        window.document.title = locales["PopupWindowBwfbTitle"];
        LocalizeElement("WindowBwfbTitleText", locales);
        LocalizeElement("WindowBwfbInfoText", locales);
        LocalizeElement("WindowBwfbWebsiteTitleText", locales);
        LocalizeElement("WindowBwfbAgreementText", locales);
        LocalizeElement("WindowBwfbReportButtonText", locales);
        LocalizeElement("WindowBwfbThanksText", locales);
        LocalizeElement("WindowBwfbAnalysisText", locales);
        LocalizeElement("WindowBwfbCloseButtonText", locales);
        Localize(document.getElementById("WindowBwfbExpandButtonText"), locales["WindowBwfbExpandButtonTextBefore"]);

        LocalizeAttribute(document.getElementById("bwfbTextArea"), "placeholder", locales["WindowBwfbTextAreaPlaceHolder"]);

        SetClickHandler("bwfbReportButton", SendReport);
        SetClickHandler("bwfbExpandButton", ExpandArea);
        SetClickHandler("bwfbCloseButton", Close);

        SetSettings();

        let websiteUrlTextElement = document.getElementById("WindowBwfbWebsiteUrlText");
        websiteUrlTextElement.innerText = report.url;

        if (websiteUrlTextElement.offsetHeight <= document.getElementById("WindowBwfbWebsiteSection").offsetHeight)
            document.getElementById("areaBwfbExpandButton").remove();

        report.type = "ufb.broken_webpage";
    }

    AvNs.RunModule(Init);
};

let m_window = null;

function OnMessage(message)
{
    try
    {
        if (browsersApi.runtime.lastError)
        {
            LogError(`popup window: onmessage error ${err.message}`);
            return;
        }

        const receiverUrl = new URL(message.receiver);
        if (receiverUrl.pathname === document.location.pathname)
        {
            if (message.command === "init")
                OnInit(message.initData);
        }
        else
        {
            SendLog(`Rejected connect to user feedback window cause invalid receiver ${message.receiver}`);
        }
    }
    catch (e)
    {
        LogError(`popup window: onmessage error ${e}`);
    }
}

function OnInit(data)
{
    if (data.cssData)
        InsertCssInline(data.cssData);

    let w = document.body.clientWidth;
    let h = document.body.clientHeight;
    let l = Math.round(screen.width/2 - w/2);
    let t = Math.round(screen.height/2 - h/2);
    ApiCall(browsersApi.windows.getCurrent)
        .OnSuccess(UpdateWindow(w, h, l, t))
        .OnError(err => LogError(`ufb: get current window failed with error ${err.message}`))
        .Start();

    if (data.pluginName === "bwfb")
        m_window = new BrokenWebpageUserFeedbackWindow(data.settings, data.locales, data.report);
    else if (data.pluginName === "phfb")
        m_window = new PhishingUserFeedbackWindow(data.settings, data.locales, data.report);
}

function UpdateWindow(w, h, l, t)
{
    return window => 
    {
        ApiCall(browsersApi.windows.update)
            .OnError(err => LogError(`ufb: update window failed with error ${err.message}`))
            .Start(window.id, { height: h, width: w, left: l, top: t });
    }
}

function SetDialogView() 
{
    document.getElementById("BeforeReportContent").style.display = "none";
    document.getElementById("AfterReportContent").style.display = "block";
}

function Close()
{
    window.close();
}

function Init()
{
    UpdateWindow(1, 1, screen.width, screen.height);
    browsersApi.runtime.onMessage.addListener(OnMessage);
    ApiCall(browsersApi.runtime.sendMessage)
        .OnError(err => LogError(`init user feeback window failed with error ${err.message}`))
        .Start({command: "init"});
}

Init();
