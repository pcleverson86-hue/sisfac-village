(ns =>
{
    ns.BrowserKeyboardInputProcessor = function BrowserKeyboardInputProcessor()
    {
        const InputKey = {
            EMPTY: 0,
            ENTER: 1,
            BACKSPACE: 2,
            SYMBOL: 3
        };

        const KeyMap = new Map([
            ["return", InputKey.ENTER],
            ["backspace", InputKey.BACKSPACE],
            ["symbol", InputKey.SYMBOL]
        ]);

        function StayFocusedAt(element)
        {
            const pos = element.selectionStart;
            element.focus();
            element.setSelectionRange(pos, pos);
        }

        function GenerateInputEvent(element, eventData)
        {
            const inputEvent = new InputEvent("input", eventData);
            return element.dispatchEvent(inputEvent);
        }

        function InsertCharacter(element, character)
        {
            const start = element.selectionStart;
            const end = element.selectionEnd;
            element.value = element.value.substring(0, start) + character + element.value.substring(end);
            element.setSelectionRange(start + character.length, start + character.length);

            GenerateInputEvent(element, { data: character, bubbles: true, inputType: "insertText", cancelable: true });
        }

        function OnBackspacePressed(element)
        {
            if (element.selectionStart === 0 && element.selectionEnd === 0)
                return false;

            let start = element.value.length;
            let end = element.value.length;

            if (element.selectionStart && element.selectionEnd) 
            {
                start = element.selectionStart;
                end = element.selectionEnd;
            }

            if (end === start)
                start -= 1;

            const lhs = element.value.substring(0, start);
            const rhs = element.value.substring(end, element.value.length);

            element.value = lhs + rhs;
            element.selectionStart = start;
            element.selectionEnd = start;

            return true;
        }

        this.OnInputAt = (element, data) =>
        {
            if (!element)
                return ns.SessionLog("Key down skip. No active element");
            if (!ns.IsElementVisible(element))
                return ns.SessionLog("Key down skip. Element not visible");

            if (data.key === InputKey.SYMBOL)
            {
                InsertCharacter(element, data.text);
            }
            else if (data.key === InputKey.ENTER)
            {
                if (element.tagName && element.tagName.toLowerCase() === "textarea")
                {
                    InsertCharacter(element, "\n");
                }
                else
                {
                    const submitElement = ns.FindElement("button", "submit") || ns.FindElement("input", "submit");
                    if (submitElement)
                    {
                        submitElement.click();
                    }
                    else
                    {
                        const ke = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, keyCode: 13 });
                        element.dispatchEvent(ke);
                    }
                }
            }
            else if (data.key === InputKey.BACKSPACE)
            {
                if (OnBackspacePressed(element))
                    GenerateInputEvent(element, { bubbles: true, inputType: "deleteContentBackward", cancelable: true });
            }

            return StayFocusedAt(element);
        };

        this.ToInputKey = key =>
        {
            if (KeyMap.has(key))
                return KeyMap.get(key);

            return InputKey.EMPTY;
        };
    };

})(AvNs);
