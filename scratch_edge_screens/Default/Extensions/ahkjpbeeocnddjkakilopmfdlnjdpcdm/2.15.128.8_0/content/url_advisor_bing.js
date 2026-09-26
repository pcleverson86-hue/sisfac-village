function GetSearchLinks()
{
    try
    {
        var links = document.querySelectorAll(
            "li.b_algo > h2 > a, .b_algo > div> div > h2 > a, .b_algo > div> h2 > a, .sb_tlst > h2 > a, .b_algo > .b_title > h2 > a, .b_algo > div > div > .b_title > h2 > a"
        );
        var results = [];
        for (var i = 0; i < links.length; ++i)
        {
            try
            {
                var linkElement = links[i];
                var hrefElement = linkElement.parentElement;
                while (hrefElement && hrefElement.nodeName !== "LI")
                    hrefElement = hrefElement.parentElement;

                var href = null;
                if (hrefElement)
                {
                    var aElement = hrefElement.querySelector(".b_tpcn > a.tilk");
                    if (aElement && !aElement.hasAttribute("redirecturl"))
                    {
                        href = aElement.href;
                    }
                    else
                    {
                        hrefElement = hrefElement.querySelector("cite");
                        if (hrefElement && hrefElement.innerHTML)
                            href = hrefElement.innerHTML.split(" ")[0];
                        if (href)
                            href = href.replace(/<[^>]+>/gi, "");
                    }
                }

                if (href && !href.endsWith("..."))
                    results.push({ element: linkElement, href: href });
                else
                    results.push({ element: linkElement, href: linkElement.href });
            }
            catch (e)
            {
                AvNs.SessionLog(e);
            }
        }
        return results;
    }
    catch (e)
    {
        AvNs.SessionError(e, "ua");
        return [];
    }
}

AvNs.GetSearchLinks = GetSearchLinks;

