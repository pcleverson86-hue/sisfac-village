function NativeMessagingAccessor(onConnectCallback, onReceivedCallback, onDisconnectedCallback)
{
    const hostName = "com.kaspersky.ahkjpbeeocnddjkakilopmfdlnjdpcdm.host";

    const m_pluginId = "nms_accessor";
    let m_port = null;
    let m_connected = false;

    function SetStorageKeyIfUndefined(key, value)
    {
        browsersApi.storage.local.get([key], values =>
        {
            if (typeof values[key] === "undefined")
            {
                const keyValue = {};
                keyValue[key] = value;
                browsersApi.storage.local.set(keyValue);
            }
        });
    }

    function OnReceived(obj)
    {
        try
        {
            CheckLastError();
            if (!m_connected)
            {
                SetStorageKeyIfUndefined("InstalledBeforeProduct", false);
                m_connected = true;
                onConnectCallback(obj);
                return;
            }
            onReceivedCallback(obj);
        }
        catch (e)
        {
            AvNs.SessionError(e, m_pluginId);
        }
    }

    function OnServerDisconnected(disconnectArg)
    {
        try
        {
            let isNeedToDelete = false;
            let reason = "";
            if (browsersApi.runtime.lastError)
            {
                const chromiumErrorText = "Specified native messaging host not found.";
                isNeedToDelete = browsersApi.runtime.lastError.message === chromiumErrorText;
                reason = browsersApi.runtime.lastError.message;
            }
            else if (disconnectArg && disconnectArg.error)
            {
                const firefoxErrorText = `No such native application ${hostName}`;
                isNeedToDelete = disconnectArg.error.message === firefoxErrorText;
                reason = disconnectArg.error.message;
            }

            ProcessNativeMessagingDisconnectError(isNeedToDelete);
            AvNs.NmsLog = AvNs.EmptyFunc;
            onDisconnectedCallback(reason);
        }
        catch (e)
        {
            AvNs.SessionError(e, m_pluginId);
        }
    }

    function RemoveSelfIfNeed()
    {
        browsersApi.storage.local.get(["InstalledBeforeProduct"], values =>
        {
            if (values.InstalledBeforeProduct === false)
                browsersApi.management.uninstallSelf();
        });
    }

    function ProcessNativeMessagingDisconnectError(isNeedToDelete)
    {
        if (isNeedToDelete)
            RemoveSelfIfNeed();
        SetStorageKeyIfUndefined("InstalledBeforeProduct", isNeedToDelete);
    }

    function Init()
    {
        m_port = browsersApi.runtime.connectNative(hostName);
        m_port.onMessage.addListener(OnReceived);
        m_port.onDisconnect.addListener(OnServerDisconnected);
    }

    this.Send = obj =>
    {
        AvNs.TrySendMessage(m_port, obj);
    };

    this.Disconnect = () => { m_port.disconnect(); };

    this.IsConnected = () => m_connected;

    Init();
}
