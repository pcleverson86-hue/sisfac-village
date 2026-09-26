function Localize(element, value)
{
    if (element)
        element.innerText = value;
}

function LocalizeAttribute(element, attribute, locale)
{
    if (element)
    {
        let value = locale.replace("{}", "");
        element.setAttribute(attribute, value);
    }
}

function LocalizeElement(key, locales)
{
    let textValue = locales[key].replace("{}", "");
    Localize(document.getElementById(key), textValue);
    let elementsByClassName = document.getElementsByClassName(key);
    for (let i = 0; i < elementsByClassName.length; ++i)
        Localize(elementsByClassName[i], textValue);
}

function InsertCssInline(cssData)
{
    "use strict";
    let style = document.createElement("style");
    style.type = "text/css";
    style.innerHTML = cssData;
    document.head.appendChild(style);
}

function SetClickHandler(id, handler, context = document)
{
    context.getElementById(id).addEventListener("click", handler);
}

function ChangeClassAttribute(from, to)
{
    let elements = document.getElementsByClassName(from);
    while (elements.length > 0) 
        elements[0].className = to;
}

let AvNs = {};
AvNs.RunModule = function RunModule(func)
{
    if (document.readyState === "loading")
    {
        let initialized = false;
        const delayFunc = function DelayFunc()
            {
                if (!initialized)
                {
                    initialized = true;
                    setTimeout(func, 0);
                }
            };

        document.addEventListener("DOMContentLoaded", delayFunc);
        window.addEventListener("load", delayFunc);
    }
    else
    {
        func();
    }
};
