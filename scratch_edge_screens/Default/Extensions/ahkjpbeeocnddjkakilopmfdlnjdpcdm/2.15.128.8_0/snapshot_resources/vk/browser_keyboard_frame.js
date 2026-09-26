let m_modifiers = {};
let m_oneClickModifiers = {};
let m_locales = {};
let m_layout = "none";

const modifiersKeys = new Set(["capslock", "shift", "alt"]);
const specialModifiersKeys = new Set(["^", "`", "´", "~"]);
const oneClickModifiersKeys = new Set(["shift", "alt", "^", "`", "´", "~"]);

function DrawShift(ctx)
{
    ctx.beginPath();
    ctx.lineWidth = 1.1;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.moveTo(06, 22);
    ctx.lineTo(10, 22);
    ctx.lineTo(10, 27);
    ctx.lineTo(16, 27);
    ctx.lineTo(16, 22);
    ctx.lineTo(20, 22);
    ctx.lineTo(13, 15);
    ctx.moveTo(06, 22);
    ctx.lineTo(13, 15);
    ctx.strokeStyle = "#888";
    ctx.stroke();
}

function DrawAlt(ctx)
{
    ctx.beginPath();
    ctx.lineWidth = 1.1;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.moveTo(00, 20);
    ctx.lineTo(06, 20);
    ctx.lineTo(11, 27);
    ctx.lineTo(19, 27);
    ctx.moveTo(11, 20);
    ctx.lineTo(19, 20);
    ctx.strokeStyle = "#888";
    ctx.stroke();
}

function DrawCapsLock(ctx, isEnabled)
{
    ctx.beginPath();
    ctx.fillStyle = isEnabled ? "#3c6" : "#888";
    ctx.arc(5, 5, 2, 0, Math.PI*2.0, true);
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.lineWidth = 1.1;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";

    ctx.moveTo(06, 17);
    ctx.lineTo(10, 17);
    ctx.lineTo(10, 22);
    ctx.lineTo(16, 22);
    ctx.lineTo(16, 17);
    ctx.lineTo(20, 17);
    ctx.lineTo(13, 10);
    ctx.moveTo(06, 17);
    ctx.lineTo(13, 10);

    ctx.moveTo(10, 24);
    ctx.lineTo(10, 27);
    ctx.lineTo(16, 27);
    ctx.lineTo(16, 24);
    ctx.lineTo(10, 24);

    ctx.strokeStyle = "#888";
    ctx.stroke();
}

function DrawReturnButton(ctx)
{
    ctx.beginPath();
    ctx.moveTo(29, 23);
    ctx.lineTo(29, 15);
    ctx.lineTo(21, 15);
    ctx.moveTo(29, 23);
    ctx.lineTo(6, 23);
    ctx.moveTo(6, 23);
    ctx.lineTo(14, 18);
    ctx.moveTo(6, 23);
    ctx.lineTo(14, 28);
    ctx.strokeStyle = "#888";
    ctx.stroke();
}

function DrawBackspace(ctx)
{
    ctx.moveTo(57, 23);
    ctx.lineTo(37, 23);
    ctx.moveTo(37, 23);
    ctx.lineTo(45, 18);
    ctx.moveTo(37, 23);
    ctx.lineTo(45, 28);
    ctx.strokeStyle = "#888";
    ctx.stroke(); 
}

function DrawTab(ctx)
{
    ctx.beginPath();
    ctx.moveTo(00, 23);
    ctx.lineTo(20, 23);
    ctx.moveTo(20, 23);
    ctx.lineTo(13, 18);
    ctx.moveTo(20, 23);
    ctx.lineTo(13, 28);
    ctx.moveTo(21, 17);
    ctx.lineTo(21, 29);
    ctx.strokeStyle = "#888";
    ctx.stroke();
}

function DrawSymbol(ctx, label)
{
    ctx.font = "15px Helvetica";
    ctx.fillStyle = "#888";
    ctx.fillText(label, 6, 15);
}

function GetImageFromLocales(name)
{
    return "url(" + m_locales[name + ".png"]+")";
}

function ModifyKeySet(from, to)
{
    if (from === to)
        return null;

    let layout = document.getElementById("BrowserKeyboardLayout");

    for (let i = 0; i < layouts[m_layout]["sets"].length; i++)
    {
        let availableSetName = layouts[m_layout]["sets"][i];
        let currentSet = document.getElementById("kl_current_set");
        let newSet = new KeySet(availableSetName + to, "kl_" + availableSetName);
        if (newSet)
        {
            layout.removeChild(currentSet);
            layout.appendChild(newSet);
            return true;
        }
        else
            return newSet;
    }
}

function ModifyKeySetBy(modificationFunction, reject)
{
    let from = GetModificationString();
    modificationFunction();
    let to = GetModificationString();

    let result = ModifyKeySet(from, to);
    if (!result && reject)
        reject();
}

function GetModificationString()
{
    let modification = "";
    for (let modifier in m_modifiers)
        if (Object.prototype.hasOwnProperty.call(m_modifiers, modifier))
            modification += "_" + modifier;
    return modification;
}

function RemoveOneClickModifications()
{
    for (let modifier in m_oneClickModifiers)
        if (Object.prototype.hasOwnProperty.call(m_oneClickModifiers, modifier))
            delete m_modifiers[modifier];
}

function RemoveModificationBy(key)
{
    return () => { delete m_modifiers[key]; }
}

function AddModificationBy(key)
{
    return () => { m_modifiers[key] = key; }
}

function IsModifiedBy(key)
{
    return m_modifiers[key];
}

function CreateLayout(name)
{
    if (!layouts[name])
    {
        name = m_layout;
        if (AvNs.IsDefined(name)) 
        {
            for (let layout in layouts)
            {
                if (Object.prototype.hasOwnProperty.call(layouts, layout))
                    name = layout;
                break;
            }
        }
    }

    m_layout = name;
    let layout = document.createElement("div");
    layout.setAttribute("id", "BrowserKeyboardLayout");
    layout.setAttribute("class", "kl_layout");

    for (let i = 0; i < layouts[name]["sets"].length; i++)
    {
        let set = layouts[name]["sets"][i];
        layout.appendChild(new KeySet(set, "kl_" + set));
    }

    return layout;
}

function ChangeLayout(name)
{
    let keyboard = document.getElementById("BrowserKeyboardRootNode");
    if (m_layout === "none")
        keyboard.appendChild(CreateLayout(name));
    else
    {
        let layout = document.getElementById("BrowserKeyboardLayout");
        keyboard.removeChild(layout);
        keyboard.appendChild(CreateLayout(name));
    }
}

let ButtonUI = function ButtonUI(key, label)
{
    const systemButtons = new Set(["capslock", "shift", "backspace", "tab", "return", "returnUS"]);

    let m_ui = null;
    let m_canvas = null;

    function Initialize()
    {
        m_ui = document.createElement("div");
        m_canvas = CreateCanvas(key, label);

        if (key === "return")
        {
            let upperShadow = document.createElement("div");
            upperShadow.setAttribute("class", "kl_return_upper_shadow");
            m_ui.appendChild(upperShadow);

            let lowerShadow = document.createElement("div");
            lowerShadow.setAttribute("class", "kl_return_lower_shadow");
            m_ui.appendChild(lowerShadow);

            let upperReturn = document.createElement("div");
            upperReturn.setAttribute("class", "kl_return_upper");
            upperReturn.appendChild(m_canvas);
            m_ui.appendChild(upperReturn);

            let lowerReturn = document.createElement("div");
            lowerReturn.setAttribute("class", "kl_return_lower");
            m_ui.appendChild(lowerReturn);
        }
        else if (key === "returnUS")
        {
            let layer = document.createElement("div");
            layer.setAttribute("class", "kl_system_shift");
            layer.appendChild(m_canvas);
            m_ui.appendChild(layer);
        }
        else 
        {
            m_ui.appendChild(m_canvas);
        }
    }

    function CreateCanvas(key, label)
    {
        let canvas = document.createElement("canvas");
        canvas.width = (key === "backspace" || key === "returnUS") ? "64" : "32";
        canvas.height = key === "return" ? "50" : "32";
        canvas.innerText = label;

        let canvasClassAttribute = systemButtons.has(key) ? "system_button_canvas" : "button_canvas";
        canvas.setAttribute("class", canvasClassAttribute);

        let ctx = canvas.getContext("2d");
        if (!DrawButton(key, ctx))
            DrawSymbol(ctx, label);
        ctx.closePath();

        return canvas;
    }

    function DrawButton(key, ctx)
    {
        if (key === "backspace")
            DrawBackspace(ctx);
        else if (key === "tab")
            DrawTab(ctx);
        else if (key === "capslock")
            DrawCapsLock(ctx, m_modifiers[key]);
        else if (key === "alt")
            DrawAlt(ctx);
        else if (key === "shift")
            DrawShift(ctx);
        else if (key === "return" || key === "returnUS")
            DrawReturnButton(ctx);
        else
            return false;
        return true;
    }

    Initialize();

    return m_ui;
}

let Button = function Button(key, data) 
{
    const releaseConditionKeySet = new Set(["symbol","backspace","capslock","tab"]);

    let m_element = null;
    let m_ui = null;
    let m_isButtonPressed = false;
    let m_timer = null;

    function Initialize()
    {
        m_element = document.createElement("div");
        m_element.setAttribute("id", key === "symbol" ? key + "_" + data.label : key);
        m_ui = new ButtonUI(key, data.label);
        m_element.appendChild(m_ui);

        if (key === "return" || key === "returnUS")
        {
            if (key === "returnUS")
                key = "return";
            m_element.setAttribute("class", data.classAttribute);
        }
        else
        {
            let btnClass = data.classAttribute;
            let classAttribute = btnClass === "kl_empty" ? btnClass : "kl_button " + btnClass;
            m_element.setAttribute("class", classAttribute);
        }

        if (key === "alt")
            RepaintAlt();
        else if (key === "shift")
            RepaintShift();

        SubscribeEvents();
    }

    function SubscribeEvents()
    {
        AddEventListener(m_element, "mouseup", OnReleased);
        AddEventListener(m_element, "mouseout", OnOuted);

        if (modifiersKeys.has(key) || specialModifiersKeys.has(key))
            AddEventListener(m_element, "mousedown", OnModifierPressed);
        else
            AddEventListener(m_element, "mousedown", OnPressed);

        if (key === "capslock")
            AddEventListener(m_element, "mousedown", RepaintCapsLock);
        else if (key === "alt")
            AddEventListener(m_element, "mousedown", RepaintAlt);
        else if (key === "shift")
            AddEventListener(m_element, "mousedown", RepaintShift);
    }

    function OnLongPressed(callback, timeout)
    {
        if (m_isButtonPressed)
        {
            callback();
            m_timer = setTimeout(() => { OnLongPressed(callback, 160); }, timeout);
        }
    }

    function ChangeState()
    {
        if (m_isButtonPressed)
        {
            m_isButtonPressed = false;
            clearTimeout(m_timer);
        }
    }

    function OnPressed()
    {
        if (key === "backspace")
        {
            m_isButtonPressed = true;
            OnLongPressed(() => { SendKey(key); }, 320);
        }
        else if (key === "return" || key === "tab")
        {
            SendKey(key);
        }
        else
        {
            m_isButtonPressed = true;
            OnLongPressed(() =>
            {
                SendData({ msg: "vk.click", key: "symbol", text: data.text});
            }, 320);

            ModifyKeySetBy(RemoveOneClickModifications);
            ChangeState();
        }
    }

    function OnOuted()
    {
        if (key === "symbol")
            ChangeState();
    }

    function OnReleased()
    {
        if (releaseConditionKeySet.has(key))
            ChangeState();
    }

    function OnModifierPressed()
    {
        if (IsModifiedBy(key))
            ModifyKeySetBy(RemoveModificationBy(key), AddModificationBy(key));
        else
        {
            if (oneClickModifiersKeys.has(key))
                m_oneClickModifiers[key] = key;
            ModifyKeySetBy(AddModificationBy(key), RemoveModificationBy(key));
        }
        SendKey(key);
    }

    function RepaintCapsLock()
    {
        let ctx = m_ui.firstChild.getContext("2d");
        ctx.beginPath();
        ctx.fillStyle = IsModifiedBy(key) ? "#3c6" : "#888";
        ctx.arc(5, 5, 2, 0, Math.PI*2.0, true);
        ctx.fill();
        ctx.closePath();
    }

    function RepaintAlt()
    {
        m_element.style.border = IsModifiedBy(key) ? "solid 1px #ff0 !important" : " ";
    }

    function RepaintShift()
    {
        m_element.style.border = IsModifiedBy(key) ? "solid 1px #9cf !important" : " ";
    }

    Initialize();

    return m_element;
}

function ButtonData(label, text, classAttribute) {
    this.label = label;
    this.text = text;
    this.classAttribute = classAttribute;
}

let KeySet = function KeySet(name, classAttribute) 
{
    const specialKeysNotModifiers = new Map([
        [ "tab", new ButtonData("Tab", "\t", "kl_system") ],
        [ "empty", new ButtonData("", "", "kl_empty") ],
        [ "backspace", new ButtonData("Backspace", "", "kl_system kl_system_backspace") ],
        [ "return", new ButtonData("Return", "", "kl_system kl_system_return") ],
        [ "returnUS", new ButtonData("Return", "", "kl_button kl_system kl_system_returnUS") ],
        [ "space", new ButtonData(" ", " ", "kl_system kl_system_space") ],
        [ "EOL", new ButtonData("Empty", "", "kl_empty") ]
      ]);

    let m_element = null;

    function Initialize()
    {
        m_element = document.createElement("div");
        m_element.setAttribute("class", "kl_set");
        m_element.setAttribute("id", "kl_current_set");

        let keys = layouts[m_layout][name];
        if (!keys)
            return keys;

        if (keys.length === 1)
            keys = layouts[m_layout][keys];

        for (let i = 0; i < keys.length; i++)
        {
            let key = keys[i];
            let layoutElement = {};

            let parsedKey = GetParsedKeyFrom(key);
            let buttonData = GetButtonDataFrom(key, classAttribute);

            if (IsModifier(key) && !modifiersKeys.has(parsedKey))
                buttonData.classAttribute = classAttribute + " kl_modifier";

            if (key === "EOL")
                layoutElement = CreateSpacer();
            else if (key === "selector")
                layoutElement = CreateSelector();
            else
                layoutElement = new Button(parsedKey, buttonData);

            m_element.appendChild(layoutElement);
        }
    }

    function IsModifierOnce(key)
    {
        return key.split("[")[1] && key.split("]")[0];
    }

    function IsModifierLong(key)
    {
        return key.split("{")[1] && key.split("}")[0];
    }

    function IsModifier(key)
    {
        return IsModifierOnce(key) || IsModifierLong(key);
    }

    function GetParsedKeyFrom(key)
    {
        if (IsModifierOnce(key))
        {
            let parsedKey = key.split("[")[1].split("]")[0];
            if (parsedKey === "shiftUS" || parsedKey === "rightshift")
                parsedKey = "shift";
            return parsedKey;
        }
        else if (IsModifierLong(key))
        {
            return key.split("{")[1].split("}")[0];
        }
        else if (specialKeysNotModifiers.has(key) || key === "selector")
        {
            return key;
        }
        return "symbol";
    }

    function GetButtonDataFrom(key, classAttribute)
    {
        let buttonData = {};
        if (IsModifierOnce(key))
        {
            let label = key.split("[")[1].split("]")[0];
            buttonData = new ButtonData(label, false, "kl_system kl_system_" + label);
        }
        else if (IsModifierLong(key))
        {
            let label = key.split("{")[1].split("}")[0];
            buttonData = new ButtonData(label, false, "kl_system kl_system_" + label);
        }
        else if (specialKeysNotModifiers.has(key))
        {
            buttonData = specialKeysNotModifiers.get(key);
        }
        else
        {
            buttonData = new ButtonData(key, key, classAttribute);
        }

        return buttonData;
    }

    function CreateSpacer()
    {
        let spacer = document.createElement("div");
        spacer.setAttribute("class", "kl_spacer");
        spacer.key = "spacer";
        return spacer;
    }

    function GetIcon(layout)
    {
        return "url('data:image/png;base64," + layouts[layout]["icon"] + "')";
    }

    function CreateLayoutItem(layout)
    {
        let item = document.createElement("div");
        item.setAttribute("id", "layout_" + layout);
        item.setAttribute("class", "kl_layout_selector_option_middle");
        item.setAttribute("locale", layout);
        item.style.backgroundImage = GetImageFromLocales("language_baloon_middle");
        AddEventListener(item, "mouseover", () => { item.style.backgroundImage = GetImageFromLocales("selection"); });
        AddEventListener(item, "mouseout", () => { item.style.backgroundImage = GetImageFromLocales("language_baloon_middle"); });
        AddEventListener(item, "click", () => { ChangeLayout(item.getAttribute("locale")); });

        let icon = document.createElement("div");
        icon.setAttribute("class", "kl_layout_selector_icon");
        icon.style.backgroundImage = GetIcon(layout);
        item.appendChild(icon);

        let label = document.createElement("div");
        label.setAttribute("class", "kl_layout_selector_label");
        label.innerText = layouts[layout]["name"];
        item.appendChild(label);

        return item;
    }

    function CreateLayoutsList()
    {
        let list = document.createElement("div");
        list.setAttribute("id", "layout_list");
        list.setAttribute("class", "kl_layout_list_container");

        let top = document.createElement("div");
        top.setAttribute("class", "kl_layout_selector_option_top");
        top.style.backgroundImage = GetImageFromLocales("language_baloon_top");
        list.appendChild(top);

        let mid = document.createElement("div");
        mid.setAttribute("class", "kl_layout_selector_option_list");
        for (let layout in layouts)
        {
            if (Object.prototype.hasOwnProperty.call(layouts, layout) && m_layout != layout)
                mid.appendChild(CreateLayoutItem(layout));
        }
        list.appendChild(mid);

        let bottom = document.createElement("div");
        bottom.setAttribute("class", "kl_layout_selector_option_bottom");
        bottom.style.backgroundImage = GetImageFromLocales("language_baloon_bottom");
        list.appendChild(bottom);

        return list;
    }

    function CreateSelector()
    {
        let selector = document.createElement("div");
        selector.setAttribute("id", "layout_selector");
        selector.setAttribute("class", "kl_layout_selector kl_top_round_corners kl_bottom_round_corners");

        let button = document.createElement("div");
        button.setAttribute("class", "kl_layout_selector_icon_button");
        button.style.backgroundImage = GetIcon(m_layout);
        selector.appendChild(button);

        let label = document.createElement("div");
        label.setAttribute("class", "kl_layout_selector_label_button");
        label.innerText = layouts[m_layout]["name"];
        selector.appendChild(label);

        let list = CreateLayoutsList();
        selector.appendChild(list);

        if (Object.keys(layouts).length > 1)
        {
            AddEventListener(selector, "click", () =>
            {
                let style = window.getComputedStyle(list);
                list.style.display = style.display === "none" ? "block" : "none";
                SendKey(""); 
            });
        }

        return selector;
    }

    Initialize();

    return m_element;
}

let VirtualKeyboard = function VirtualKeyboard()
{
    let m_element = null;
    let m_defaultLayout = "en";

    function CreateCloseButton()
    {
        let closeButton = document.createElement("div");
        closeButton.setAttribute("id", "close");
        closeButton.setAttribute("class", "kl_kb_close_button");
        closeButton.style.backgroundImage = GetImageFromLocales("close");
        AddEventListener(closeButton, "mouseover", () => { closeButton.style.backgroundImage = GetImageFromLocales("close_hover"); });
        AddEventListener(closeButton, "mouseout", () => { closeButton.style.backgroundImage = GetImageFromLocales("close"); });
        AddEventListener(closeButton, "click", () => { SendClose(0); });
        return closeButton;
    }

    function Initialize()
    {
        m_element = document.createElement("div");
        m_element.id = "BrowserKeyboardRootNode";
        m_element.setAttribute("dir", "ltr");
        m_element.setAttribute("class", "kl_keyboard");
        m_element.style.backgroundImage = GetImageFromLocales("kb_bg");

        let hook = document.createElement("div");
        hook.setAttribute("class", "kl_hook");
        hook.appendChild(CreateCloseButton());
        m_element.appendChild(hook);

        m_element.appendChild(CreateLayout(m_defaultLayout));
    }

    Initialize();

    return m_element;
}

let baseMouseX = 0;
let baseMouseY = 0;

const DragObservableClasses = new Set(["kl_hook", "kl_keyboard", "kl_set"]);
function OnDragStart(event)
{
    if (!DragObservableClasses.has(event.target.className))
        return;

    baseMouseX = event.clientX;
    baseMouseY = event.clientY;

    SendData({
        msg: "vk.dragStart",
        mouseX: baseMouseX,
        mouseY: baseMouseY
    });
    document.addEventListener("mouseup", OnDragEnd);
    document.addEventListener("mousemove", OnDrag);
}

let eps = 10;

function IsFastChange(prevPos, pos)
{
    return pos * prevPos < 0 && Math.abs(pos - prevPos) > eps;
}

let m_locked = false;
let m_dxPrev = 0;
let m_dyPrev = 0;

function OnDrag(event)
{
    if (!m_locked)
    {
        m_locked = true;

        let dx = Math.round(event.clientX - baseMouseX);
        let dy = Math.round(event.clientY - baseMouseY);

        if (IsFastChange(m_dxPrev, dx) || IsFastChange(m_dyPrev, dy))
        {
            m_locked = false;
            return;
        }

        SendData({ msg: "vk.drag", offsetX: dx, offsetY: dy });
        m_dxPrev = dx;
        m_dyPrev = dy;
    }
}

function OnDragEnd() 
{
    m_dxPrev = 0;
    m_dyPrev = 0;
    SendData({ msg: "vk.dragEnd" });
    document.removeEventListener("mouseup", OnDragEnd);
    document.removeEventListener("mousemove", OnDrag);
}

function SendKey(key)
{
    SendData({ msg: "vk.click", key: key });
}

window.FrameObject.onInitData = function OnPopupWindowInit()
{
    let keyboard = document.getElementById("BrowserKeyboardRootNode");
    if (keyboard === null)
    {
        let keyboardWrapper = document.createElement("div");
        keyboardWrapper.setAttribute("class", "kl_keyboard_wrapper");
        keyboardWrapper.appendChild(new VirtualKeyboard());
        AddEventListener(keyboardWrapper, "mousedown", OnDragStart);
        document.body.appendChild(keyboardWrapper);
        setTimeout(() =>
        {
            let vkbd = document.getElementById("BrowserKeyboardRootNode");
            SendData({ msg: "vk.created", width: vkbd.offsetWidth, height: vkbd.offsetHeight }); 
        }, 50);
    }
}

window.FrameObject.onGetData = function OnGetData()
{
    m_locked = false;
}

window.FrameObject.onLocalize = function OnLocalize(locales)
{
    m_locales = locales;
}
