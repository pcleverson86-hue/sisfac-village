function HandlePopupStartupParameters(request, sender, sendResponse)
{
    try
    {
        if (browsersApi.runtime.lastError)
        {
            AvNs.SessionLog(`Error on handle popup startup parameters: ${browsersApi.runtime.lastError.message}`);
            return false;
        }    
        if (!AvNs.IsSenderPopup(sender))
            return false;

        if (request.command === "getPopupStartupParameters")
            AvNs.TrySendResponse(sendResponse, { isConnectedToProduct: AvNs.IsConnectedToProduct });
        return false;
    }
    catch (e)
    {
        AvNs.SessionError(e);
    }
}

browsersApi.runtime.onMessage.addListener(HandlePopupStartupParameters);
