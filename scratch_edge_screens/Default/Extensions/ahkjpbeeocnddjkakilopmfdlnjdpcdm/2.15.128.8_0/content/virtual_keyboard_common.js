(ns =>
{

ns.IsPositionEqual = (prevPos, currentPos) => prevPos && currentPos && prevPos.top === currentPos.top && prevPos.left === currentPos.left;

ns.GetAbsoluteElementPosition = element =>
{
    const scroll = ns.GetPageScroll();
    const rect = {
        left: scroll.left,
        top: scroll.top,
        right: scroll.left,
        bottom: scroll.top
    };

    if (element)
    {
        const box = element.getBoundingClientRect();
        rect.left += box.left;
        rect.top += box.top;
        rect.right += box.right;
        rect.bottom += box.bottom;
    }

    return rect;
};

})(AvNs);
