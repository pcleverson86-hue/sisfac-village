let m_tabId = null;
let m_url = null;
let m_isOffline = false;
const m_scopeStyles = {};
const m_expand = {};
let m_isSessionStarted = false;

AvNs.QueryActiveTabFromPopupArgs = { active: true, windowType: "normal", currentWindow: true };

function StartPopupSession()
{
    ApiCall(browsersApi.tabs.query)
        .OnSuccess(([tab]) =>
            {
                if (!tab)
                    return;

                m_tabId = AvNs.EncodeTabId(tab.windowId, tab.id, 0);
                m_url = tab.url;
                AvNs.SessionLog(`Query tabs succeeded, tabId: ${m_tabId}`);
                ApiCall(browsersApi.runtime.sendMessage)
                    .OnSuccess(response =>
                        {
                            m_isOffline = !response.isConnectedToProduct;
                            if (m_isOffline)
                                SetOffline();
                            AvNs.RunModule(() =>
                                {
                                    if (!m_isSessionStarted)
                                    {
                                        m_isSessionStarted = true;
                                        AvNs.StartSession();
                                    }
                                });
                        })
                    .OnError(err => AvNs.SessionLog(`getPopupStartupParameters failed with error ${err.message}`))
                    .Start({ command: "getPopupStartupParameters" });
            })
        .OnError(err => AvNs.SessionError(err, "popup_base"))
        .Start(AvNs.QueryActiveTabFromPopupArgs);
}

StartPopupSession();

function SetOffline()
{
    if (document && document.body && document.body.className)
        document.body.className = "offline";
    else
        AvNs.SetTimeout(SetOffline, 100);
}

AvNs.GetTabId = () => m_tabId;

function Localize(element, value)
{
    if (element)
        element.innerText = value;
}

function LocalizeElement(key, locales)
{
    const textValue = (key in locales) ? locales[key].replace("{}", "") : key;
    Localize(document.getElementById(key), textValue);
    const elementsByClassName = document.getElementsByClassName(key);
    for (const elem of elementsByClassName)
        Localize(elem, textValue);
}

function LocalizeTitle(locales)
{
    try
    {
        const key = "PopupTitle";
        if (locales && locales[key] && locales[key] !== key)
            LocalizeElement(key, locales);
    }
    catch (error)
    {
        AvNs.SessionError(error, "popup_base");
    }
}

function SetClickHandler(id, handler, context = document)
{
    const element = context.getElementById(id);
    if (element)
        AvNs.AddEventListener(element, "click", handler);
    else
        AvNs.SessionLog(`not found element with id: ${id}`);
}

var runnerOptions = {
    name: "popup_base",
    runner: RunnerImpl,
    getParameters: () => ({ tabId: m_tabId }),
    onConnectionError: SetOffline,
    reject: SetOffline
};
AvNs.AddRunner2(runnerOptions);
function RunnerImpl(ns, session, settings, locales)
{
    m_isOffline = false;

    function Init()
    {
        const addingStyles = [];
        addingStyles.push(locales["PopupCustomizationCss"]);
        ns.AddStyles(addingStyles);
        LocalizeTitle(locales);

        const url = AvNs.TryCreateUrl(m_url);
        if (url)
        {
            const urlContainers = document.getElementsByClassName("CurrentHost");
            for (const urlContainer of urlContainers)
                urlContainer.innerText = url.host;
        }

        session.InitializePlugin(activatePlugin => { activatePlugin("popup_base", OnPing, OnError); });
    }

    function OnPing()
    {
        return ns.MaxRequestDelay;
    }

    function OnError()
    {
        m_isOffline = true;
        ApplyStyles();
    }

    Init();
}

AvNs.ApplyStyle = (scope, applyingStyles) =>
{
    m_scopeStyles[scope] = { styles: applyingStyles };
    ApplyStyles();
};

AvNs.SetAreaExpandable = (areaHeaderId, areaScrollableContentId, expandClassName, isExpandable) =>
{
    if (!m_expand[areaHeaderId])
    {
        SetClickHandler(areaHeaderId, () => { OnExpand(areaHeaderId); });
        m_expand[areaHeaderId] = {};
        m_expand[areaHeaderId].isExpanded = false;
    }

    m_expand[areaHeaderId].isExpandable = isExpandable;
    m_expand[areaHeaderId].headerId = areaHeaderId;
    m_expand[areaHeaderId].scrollableContentId = areaScrollableContentId;
    m_expand[areaHeaderId].expandClassName = expandClassName;

    SetExpandableHeadersClassName();
    ApplyStyles();
};

function ApplyStyles()
{
    if (m_isOffline)
    {
        SetOffline();
        return;
    }

    const styles = [];
    if (AvNs.IsRtl)
        styles.push("rtl");

    document.body.style.height = "1px";

    for (const currentScope in m_scopeStyles)
    {
        if ({}.hasOwnProperty.call(m_scopeStyles, currentScope))
            styles.push(m_scopeStyles[currentScope].styles.join(" "));
    }
    for (const currentArea in m_expand)
    {
        if ({}.hasOwnProperty.call(m_expand, currentArea))
        {
            const area = m_expand[currentArea];
            if (area.isExpandable && area.isExpanded)
            {
                styles.push(area.expandClassName);
                break;
            }
        }
    }
    const resultStyle = styles.join(" ");
    document.body.className = resultStyle;

    document.body.style.height = "max-content";
}

function SetExpandableHeadersClassName()
{
    for (const currentArea in m_expand)
    {
        if ({}.hasOwnProperty.call(m_expand, currentArea))
        {
            const area = m_expand[currentArea];
            const headerClassNames = ["area-header"];
            const headerScrollableClassNames = ["area-bodyContent"];
            if (area.isExpandable)
            {
                if (area.isExpanded)
                {
                    headerClassNames.push("area-expandable_expanded");
                    headerClassNames.push("area-expandable_expanded-Image_custom");
                    headerScrollableClassNames.push("scrollable-content");
                }
                else
                {
                    headerClassNames.push("area-expandable");
                    headerClassNames.push("area-expandable-Image_custom");
                }
            }
            document.getElementById(area.headerId).className = headerClassNames.join(" ");
            document.getElementById(area.scrollableContentId).className = headerScrollableClassNames.join(" ");
        }
    }
}

function OnExpand(areaHeaderId)
{
    if (!m_expand[areaHeaderId] || !m_expand[areaHeaderId].isExpandable)
        return;
    const isExpanded = m_expand[areaHeaderId].isExpanded;
    for (const currentArea in m_expand)
    {
        if ({}.hasOwnProperty.call(m_expand, currentArea))
            m_expand[currentArea].isExpanded = false;
    }
    m_expand[areaHeaderId].isExpanded = !isExpanded;

    SetExpandableHeadersClassName();
    ApplyStyles();
}
