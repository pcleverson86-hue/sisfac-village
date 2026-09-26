AvNs.AddRunner("cb", function AddRunnerCB(ns, session)
{

    function ContentBlocker()
    {
        var m_idleStartTime = ns.GetCurrentTime();

        var m_callFunction = ns.EmptyFunc;

        function OnPing(currentTime)
        {
            var idleTime = (currentTime >= m_idleStartTime) ? currentTime - m_idleStartTime : 0;

            return idleTime <= 10000 ? 500 : ns.MaxRequestDelay;
        }

        function ReloadUrl()
        {
            m_idleStartTime = ns.GetCurrentTime();
            session.Reload();
        }

        function blockImageByPath(url, blockImageResponse)
        {
            var endsWithUrl = function endsWithUrl(pattern)
                {
                    var d = pattern.length - url.length;
                    return d >= 0 && pattern.lastIndexOf(url) === d;
                };

            var images = document.getElementsByTagName("img");
            for (var i = 0; i !== images.length; ++i)
            {
                if (endsWithUrl(images[i].src) && images[i].style.display !== "none")
                {
                    images[i].style.display = "none";
                    ++blockImageResponse.blockedImagesCount;
                }
            }
        }

        function BlockImage(blockImageRequest)
        {
            var blockImageResponse = { blockedImagesCount: 0, requestId: "" };

            var SendResponse = function SendResponseImpl() 
            {
                m_callFunction("cb.BlockResults", blockImageResponse);
                SendResponse = ns.EmptyFunc;
            };

            try
            {
                blockImageResponse.requestId = blockImageRequest.requestId;

                for (var i = 0; i !== blockImageRequest.urls.length; ++i)
                    blockImageByPath(blockImageRequest.urls[i], blockImageResponse);

                SendResponse();
            }
            catch (e)
            {
                SendResponse();
                throw e;
            }
        }

        session.InitializePlugin(function InitializePluginContentBlocker(activatePlugin, registerMethod, callFunction, deactivatePlugin)
        {
            m_callFunction = callFunction;

            activatePlugin("cb", OnPing);
            registerMethod("cb.reloadUrl", ReloadUrl);
            registerMethod("cb.blockImage", BlockImage);
            registerMethod("cb.shutdown",
                function ShutdownCB()
                {
                    deactivatePlugin("cb");
                });

        });
    }

    var m_contentBlocker = new ContentBlocker(); 
});
