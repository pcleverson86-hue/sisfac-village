AddEventListener(window, "load", () =>
    {
        let button = document.getElementById("button");
        if (button)
        {
            AddEventListener(button, "click", OnClick);
            AddEventListener(button, "mouseover", OnMouseOver);
            AddEventListener(button, "mouseout", OnMouseOut);
        }
    }
);

function OnClick()
{
    SendData({ showKeyboard : true});
}

function OnMouseOver()
{
    let button = document.getElementById("button");
    button.style.filter = "alpha(opacity=60)";  
    button.style.opacity = 0.6;
}

function OnMouseOut()
{
    let button = document.getElementById("button");
    button.style.filter = "alpha(opacity=100)"; 
    button.style.opacity = 1;
}
