function SendLog(message)
{
    ApiCall(browsersApi.runtime.sendMessage)
        .OnError(err => console.log(`ptp: send log failed with error ${err.message}`)) 
        .Start({command: "log", log: message});
}

let PopupWindow = function PopupWindow(locales)
{
    function InfoLink()
    {
        if (locales["WindowPtpMoreInfoLink"])
        {
            ApiCall(browsersApi.runtime.sendMessage)
                .OnError(err => SendLog(`ptp: infoLink failed with error ${err.message}`))
                .Start({ command: "ptp.openInfoLink" });
            window.open(locales["WindowPtpMoreInfoLink"]);
        }
    }

    function UpgradeButton()
    {
        if (locales["WindowPtpUpgradeButtonLink"])
        {
            ApiCall(browsersApi.runtime.sendMessage)
                .OnError(err => SendLog(`ptp: openUpgrade failed with error ${err.message}`))
                .Start({ command: "ptp.openUpgrade" });
            window.open(locales["WindowPtpUpgradeButtonLink"]);
            window.close();
        }
    }
    function Init()
    {
        window.document.title = locales["WindowPtpTitle"];
        LocalizeElement("WindowPtpHeader", locales);
        LocalizeElement("WindowPtpInfo", locales);
        LocalizeElement("WindowPtpMoreInfoText", locales);
        LocalizeElement("WindowPtpUpgradeButtonText", locales);

        SetClickHandler("WindowPtpMoreInfo", InfoLink);
        SetClickHandler("WindowPtpUpgradeButton", UpgradeButton);
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
            SendLog(`popup window: onmessage error ${err.message}`);
            return;
        }
        if (!message.receiver)
            return;

        const receiverUrl = new URL(message.receiver);
        if (receiverUrl.pathname === document.location.pathname)
        {
            if (message.command === "init")
                OnInit(message.initData);
        }
        else
        {
            SendLog(`Rejected connect to paid_tier_promo window cause invalid receiver ${message.receiver}`);
        }
    }
    catch (e)
    {
        SendLog(`Popup window: onmessage error ${e}`);
    }
}

function OnInit(data)
{
    if (data.cssData)
        InsertCssInline(data.cssData);

    let w = document.body.clientWidth || document.documentElement.clientWidth;
    let h = (document.body.clientHeight || document.documentElement.clientHeight) + window.outerHeight - window.innerHeight;
    let l = Math.round(screen.width/2 - w/2);
    let t = Math.round(screen.height/2 - h/2);
    ApiCall(browsersApi.windows.getCurrent)
        .OnSuccess(UpdateWindow(w, h, l, t))
        .OnError(err => SendLog(`ptp: get current window failed with error ${err.message}`))
        .Start();

    m_window = new PopupWindow(data.locales);
}

function UpdateWindow(w, h, l, t)
{
    return window => 
    {
        ApiCall(browsersApi.windows.update)
            .OnError(err => SendLog(`ptp: update window failed with error ${err.message}`))
            .Start(window.id, { height: h, width: w, left: l, top: t });
        SendLog(`ptp: Update window with id ${window.id} (${w}, ${h}, ${l}, ${t})`);
    }
}

function Init()
{    
    browsersApi.runtime.onMessage.addListener(OnMessage);
    ApiCall(browsersApi.runtime.sendMessage)
        .OnError(err => SendLog(`ptp: init user feeback window failed with error ${err.message}`))
        .Start({command: "init"});
}

Init();
