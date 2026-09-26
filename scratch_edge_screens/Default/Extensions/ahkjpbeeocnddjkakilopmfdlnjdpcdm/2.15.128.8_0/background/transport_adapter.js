function TransportAdapter(onConnectCallback, onReceivedCallback, onDisconnectCallback)
{
    const m_secureInputClientId = 0;
    const m_backgroundClientId = 1;
    const m_pluginId = "nms_back";

    let m_clientId = 2;
    let m_contentPorts = {};
    let m_nmServer = null;
    let m_backgroundMessagePart = "";
    let m_supported = true;
    let m_protocolVersion = 0;
    let m_secureInputPort = null;

    function CheckPort(port)
    {
        if (typeof port === "undefined" || typeof port.id === "undefined")
            return false;
        return true;
    }


    function ProcessNewContentConnection(port)
    {
        if (port.name === "content_transport")
        {
            port.id = m_clientId++;
            port.messageBuffer = "";
            m_contentPorts[port.id] = port;
            port.onDisconnect.addListener(() =>
                {
                    try
                    {
                        const shutdownCommand = { callId: 0, command: "shutdown", commandAttribute: "disconnect", timestamp: AvNs.GetCurrentIsoDate() };
                        if (m_nmServer)
                            m_nmServer.Send({ clientId: port.id, message: JSON.stringify(shutdownCommand) });
                        delete m_contentPorts[port.id];
                        if (m_secureInputPort && m_secureInputPort.id === port.id)
                            m_secureInputPort = null;
                    }
                    catch (e)
                    {
                        AvNs.SessionError(e, m_pluginId);
                    }
                });
            port.onMessage.addListener(ProcessMessage);
            SendConnected(port);
        }
    }

    function ProcessSpecificSecureInputCall(msgObject, port)
    {
        try
        {
            if (msgObject.commandAttribute === "vk.startProtect")
            {
                m_secureInputPort = port;
            }
            else if (msgObject.commandAttribute === "vk.stopProtect")
            {
                if (m_secureInputPort && m_secureInputPort.id === port.id)
                    m_secureInputPort = null;
            }
            else if (msgObject.command === "nms")
            {
                port.nmsCaller = true;
                if (msgObject.commandAttribute.startsWith("CheckKeyboardLayout"))
                    return "CheckKeyboardLayout";
                return msgObject.commandAttribute;
            }
        }
        catch (e)
        {
            AvNs.SessionError(e, m_pluginId);
        }
        return msgObject;
    }

    function ProcessMessage(obj, port)
    {
        try
        {
            CheckLastError();
            if (!CheckPort(port) || !m_nmServer)
            {
                port.disconnect();
                delete m_contentPorts[port.id];
                if (m_secureInputPort && m_secureInputPort.id === port.id)
                    m_secureInputPort = null;
                return;
            }

            if (obj.command === "shutdown" && m_contentPorts[port.id])
                m_contentPorts[port.id].shutdownPending = true;

            const resendMessage = ProcessSpecificSecureInputCall(obj, port);
            if (resendMessage !== null)
                m_nmServer.Send({ clientId: port.id, message: typeof resendMessage === "string" ? resendMessage : JSON.stringify(resendMessage) });
        }
        catch (e)
        {
            AvNs.SessionError(e, m_pluginId);
        }
    }

    function SendConnected(port)
    {
        AvNs.TrySendMessage(port, { version: m_protocolVersion, portId: port.id });
    }

    function GetErrorMessage(error)
    {
        var msg = "";
        if (error instanceof Error)
        {
            msg = error.message;
            if (error.stack)
                msg += "\r\n" + error.stack;
        }
        else if (error instanceof Object)
        {
            msg = JSON.stringify(error);
        }
        else
        {
            msg = String(error);
        }
        return msg.length <= 2048 ? msg : (msg.substring(0, 2048) + "<...>");
    }

    function OnConnect(obj)
    {
        if (obj.protocolVersion < 2 || obj.connect === "unsupported")
        {
            m_supported = false;
            DestroyAdapter();
        }
        else if (obj.connect === "ok")
        {
            m_protocolVersion = obj.protocolVersion;
            Object.keys(m_contentPorts).forEach(key =>
            {
                const port = m_contentPorts[key];
                SendConnected(port);
            });
            if (obj.protocolVersion > 5)
            {
                AvNs.NmsLog = err =>
                {
                    try
                    {
                        m_nmServer.Send({ clientId: -1, command: "ext_log", message: GetErrorMessage(err) });
                    }
                    catch (e)
                    {}
                };
            }
            browsersApi.runtime.onConnect.addListener(OnNewPortConnect);
            onConnectCallback(obj);
        }
        else
        {
            DestroyAdapter();
        }
    }

    function ProcessUnknownPortMessage(obj)
    {
        if (obj.clientId === 0 && m_protocolVersion < 4)
        {
            Object.keys(m_contentPorts).forEach(key =>
            {
                const port = m_contentPorts[key];
                if (port.nmsCaller)
                    AvNs.TrySendMessage(port, JSON.parse(obj.message));
            });
        }
        else
        {
            AvNs.SessionLog(`${obj.clientId} Port didn't find`);
        }
    }

    function OnReceivedImpl(obj)
    {
        try
        {
            if (typeof obj.clientId === "undefined")
            {
                AvNs.SessionError("Invalid message");
                return;
            }

            if (obj.clientId === m_backgroundClientId)
            {
                if (!obj.isFinished)
                {
                    m_backgroundMessagePart += obj.message;
                }
                else
                {
                    obj.message = m_backgroundMessagePart + obj.message;
                    onReceivedCallback(obj);
                    m_backgroundMessagePart = "";
                }
                return;
            }

            const port = obj.clientId === m_secureInputClientId ? m_secureInputPort : m_contentPorts[obj.clientId];
            if (!port)
            {
                ProcessUnknownPortMessage(obj);
                return;
            }

            if (port.shutdownPending)
                return;

            if (m_protocolVersion < 3)
            {
                AvNs.TrySendMessage(port, JSON.parse(obj.message));
                return;
            }

            if (!obj.isFinished)
            {
                port.messageBuffer += obj.message;
            }
            else
            {
                AvNs.TrySendMessage(port, JSON.parse(port.messageBuffer + obj.message));
                port.messageBuffer = "";
                PingImpl();
            }
        }
        catch (e)
        {
            AvNs.SessionError(e);
        }
    }

    function OnNewPortConnect(port)
    {
        try
        {
            CheckLastError();
            ProcessNewContentConnection(port);
        }
        catch (e)
        {
            AvNs.SessionError(e);
        }
    }

    function Init()
    {
        m_nmServer = new NativeMessagingAccessor(OnConnect, OnReceivedImpl, DestroyAdapter);
    }

    function DestroyAdapter(msg)
    {
        if (msg)
            AvNs.SessionLog(`NMS turn on unsupported state: ${msg}`);
        onDisconnectCallback(msg);

        if (browsersApi.runtime.onConnect.hasListener(OnNewPortConnect))
            browsersApi.runtime.onConnect.removeListener(OnNewPortConnect);
        if (m_nmServer)
        {
            m_nmServer.Disconnect();
            m_nmServer = null;
        }
        Object.keys(m_contentPorts).forEach(key =>
        {
            const port = m_contentPorts[key];
            port.disconnect();
        });
        m_contentPorts = {};
    }

    function SendBackgroundImpl(obj)
    {
        const nmsPackage = { clientId: m_backgroundClientId, message: JSON.stringify(obj) };
        m_nmServer.Send(nmsPackage);
    }

    function PingImpl()
    {
        const pingCommandName = "KeepServiceWorkerAlive";
        const pingMessageObject = {
            clientId: m_backgroundClientId,
            message: pingCommandName,
            command: pingCommandName
        };
        if (m_nmServer)
            m_nmServer.Send(pingMessageObject);
    }

    Init();

    this.Send = SendBackgroundImpl;
    this.Ping = PingImpl;
    this.Disconnect = DestroyAdapter;
    this.IsConnected = () => m_supported && m_nmServer && m_nmServer.IsConnected();
}
