var avSessionInstance = null;
(function SessionMain(ns)
{
    var runners = {};
    var lastPostponedInitTime = ns.GetCurrentTime();
    var postponedInitTimeout = null;
    var enableTracing = false;
    var initPending = false;
    var restartInterval = 0;
    var sessionMarkedForbidden = false;


    var CallReceiver = function CallReceiver(caller)
    {
        var m_plugins = {};
        var m_receiver = caller.GetReceiver();
        var m_caller = caller;
        var m_selfMethods = {};

        function GetPluginIdFromMethodName(methodName)
        {
            if (methodName)
            {
                var names = ns.StringSplit.call(methodName, ".", 2);
                if (names.length === 2)
                    return names[0];
            }
            return null;
        }

        function GetPluginMethods(pluginId)
        {
            var plugin = m_plugins[pluginId];
            return plugin ? plugin.methods : null;
        }

        function CheckCommonMethodName(methodName)
        {
            if (methodName)
            {
                var names = ns.StringSplit.call(methodName, ".", 2);
                if (names.length === 1 && names[0] === methodName)
                    return true;
            }
            return false;
        }

        this.RegisterMethod = function RegisterMethod(methodName, callback)
        {
            var pluginId = GetPluginIdFromMethodName(methodName);
            if (pluginId)
            {
                var methods = GetPluginMethods(pluginId);
                if (methods)
                {
                    if (methods[methodName])
                        return;

                    methods[methodName] = callback;
                }
                else
                {
                    throw new Error("Cannot registered " + methodName);
                }
            }
            else if (CheckCommonMethodName(methodName))
            {
                if (m_selfMethods[methodName])
                    throw new Error("Already registered method " + methodName);
                m_selfMethods[methodName] = callback;
            }
        };

        function CallPluginMethod(pluginId, methodName, args)
        {
            var callback = null;
            if (pluginId)
            {
                var methods = GetPluginMethods(pluginId);
                if (methods) 
                    callback = methods[methodName];
            } 
            else
            {
                callback = m_selfMethods[methodName];
            }
            if (callback)
            {
                var result = {};
                try 
                {
                    if (args)
                        callback(ns.JSONParse(args));
                    else
                        callback();
                    result.success = true;
                    m_caller.SendResult(methodName, ns.JSONStringify(result));
                    return true;
                }
                catch (e)
                {
                    result.success = false;
                    m_caller.SendResult(methodName, ns.JSONStringify(result));
                    ns.SessionError(e, (pluginId ? pluginId : "common"));
                    return false;
                }
            }
            ns.SessionLog("Cannot call " + methodName + " for plugin " + (pluginId ? pluginId : "common"));
            return false;
        }

        function CallMethod(methodName, args)
        {
            var pluginId = GetPluginIdFromMethodName(methodName);
            if (pluginId || CheckCommonMethodName(methodName))
                CallPluginMethod(pluginId, methodName, args);
        }

        function ReportPluginError(pluginId, status)
        {
            var onError = m_plugins[pluginId].onError;
            if (onError)
                onError(status);
        }

        function ReportError(status)
        {
            for (var pluginId in m_plugins)
            {
                if (ns.ObjectHasOwnProperty.call(m_plugins, pluginId))
                    ReportPluginError(pluginId, status);
            }
        }

        function UpdateDelay()
        {
            var newDelay = ns.MaxRequestDelay;
            var currentTime = ns.GetCurrentTime();

            for (var pluginId in m_plugins)
            {
                if (!ns.ObjectHasOwnProperty.call(m_plugins, pluginId))
                    continue;

                try 
                {   
                    var onPing = m_plugins[pluginId].onPing;
                    if (onPing)
                    {
                        var delay = onPing(currentTime);
                        if (delay < newDelay && delay > 0 && delay < ns.MaxRequestDelay)
                            newDelay = delay;
                    }
                }
                catch (e)
                {
                    ReportPluginError(pluginId, "UpdateDelay: " + (e.message || e));
                }
            }

            return newDelay;
        }

        this.RegisterPlugin = function RegisterPlugin(pluginId, callbackPing, callbackError, callbackShutdown)
        {
            if (m_plugins[pluginId])
                return;

            var plugin = {
                onError: callbackError,
                onPing: callbackPing,
                onShutdown: callbackShutdown,
                methods: {}
            };

            m_plugins[pluginId] = plugin;

            if (!m_receiver.IsStarted())
                m_receiver.StartReceive(CallMethod, ReportError, UpdateDelay);
        };

        function IsPluginListEmpty()
        {
            for (var key in m_plugins)
            {
                if (ns.ObjectHasOwnProperty.call(m_plugins, key))
                    return false;
            }
            return true;
        }

        this.UnregisterPlugin = function UnregisterPlugin(pluginId)
        {
            delete m_plugins[pluginId];

            if (IsPluginListEmpty())
                m_receiver.StopReceive();
        };

        this.ForceReceive = function ForceReceive()
        {
            m_receiver.ForceReceive();
        };

        this.StopReceive = function StopReceive()
        {
            m_receiver.StopReceive();
        };

        this.UnregisterAll = function UnregisterAll()
        {
            if (IsPluginListEmpty())
                return;

            for (var key in m_plugins)
            {
                if (ns.ObjectHasOwnProperty.call(m_plugins, key)) 
                    m_plugins[key].onShutdown();
            }

            m_plugins = {};
        };

        this.IsEmpty = IsPluginListEmpty;
        this.IsProductConnected = function IsProductConnected()
        {
            return m_receiver.IsProductConnected();
        };
    };

    function LocalizationObjectFromDictionary(dictionary)
    {
        var object = {};
        if (dictionary)
        {
            for (var i = 0; i < dictionary.length; i++)
                object[dictionary[i].name] = dictionary[i].value;
        }
        return object;
    }

    function SettingsObjectFromSettingsJson(settingsJson)
    {
        var object = {};
        if (settingsJson)
            object = ns.JSONParse(settingsJson);
        return object;
    }

    var AvSessionClass = function AvSessionClass(caller)
    {
        var self = this;
        var m_caller = caller;
        var m_callReceiver = new CallReceiver(caller);


        function Call(methodName, argsObj, callbackResult, callbackError)
        {
            if (!m_callReceiver.IsProductConnected())
                return;

            if (methodName === "nms")
            {
                if (!m_caller.nmsCallSupported)
                {
                    ns.LogError("Unsupported nms call", "common");
                    return;
                }

                const method = typeof argsObj === "object" ? "nms" + ns.JSONStringify(argsObj) : argsObj;
                m_caller.Call("nms", method, null, null, null);
                return;
            }
            var callback = function callback(result, args, method)
                {
                    if (callbackResult)
                        callbackResult(result, args ? ns.JSONParse(args) : null, method);
                };
            var data = (argsObj)
                ? ns.JSONStringify(
                    {
                        result: 0,
                        method: methodName,
                        parameters: ns.JSONStringify(argsObj)
                    }
                    )
                : null;

            m_caller.Call("to", methodName, data, callback, callbackError);
        }

        function OnUnloadCall()
        {
            return false;
        }

        function StopImpl(reason)
        {
            try
            {
                for (var runner in runners)
                {
                    if (!ns.ObjectHasOwnProperty.call(runners, runner))
                        continue;
                    try
                    {
                        if (runner.stop)
                            runner.stop(AvNs, avSessionInstance);
                    }
                    catch (e)
                    {
                        AvNs.Log(e);
                    }
                }
                m_callReceiver.UnregisterAll();

                if (m_callReceiver.IsProductConnected())
                    m_caller.Call("shutdown", reason);
                m_callReceiver.StopReceive();

                if (m_caller.Shutdown)
                    m_caller.Shutdown();
            }
            catch (e)
            {
            }
        }

        function DeactivatePlugin(pluginId)
        {
            m_callReceiver.UnregisterPlugin(pluginId);
            if (m_callReceiver.IsEmpty())
                StopImpl();
        }

        function ActivatePlugin(pluginId, callbackPing, callbackError, callbackShutdown)
        {
            m_callReceiver.RegisterPlugin(
                pluginId,
                callbackPing,
                function RegisterPluginOnError(e)
                {
                    callbackError && callbackError(e);
                    m_callReceiver.UnregisterPlugin(pluginId);
                    if (m_callReceiver.IsEmpty())
                        StopImpl();
                },
                function RegisterPluginOnShutdown()
                {
                    try
                    {
                        callbackShutdown && callbackShutdown();
                    }
                    catch (ex)
                    {
                        ns.SessionError(ex, pluginId);
                    }
                }
            );
        }

        function RegisterMethod(methodName, callback)
        {
            m_callReceiver.RegisterMethod(methodName, callback);
        }

        function ReloadImpl()
        {
        }

        function ServiceWorkerAllowed()
        {
            try
            {
                return navigator && navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.state === "activated";
            }
            catch (e)
            {
                ns.SessionLog("Service worker not allowed. Error: " + e.message);
                return false;
            }
        }

        function Redirect(param)
        {
            document.location.href = param.targetUrl;
        }

        function ReloadPage()
        {
            if (ServiceWorkerAllowed())
            {
                ns.SetTimeout(ReloadImpl, 1000);
                navigator.serviceWorker.getRegistrations()
                    .then(function getRegistrationsThen(regs)
                        {
                            var countUnregistered = 0;
                            var rest = function rest()
                                {
                                    ++countUnregistered;
                                    if (countUnregistered === regs.length)
                                        ReloadImpl();
                                }; 
                            for (var i = 0; i < regs.length; ++i)
                            {
                                regs[i].unregister()
                                    .then(rest, rest);
                            }
                        }, ReloadImpl);
            }
            else
            {
                ns.SetTimeout(ReloadImpl, 300);
            }
        }

        function OnStartError(injectorName)
        {
            try 
            {
                var connectionErrorCallback = runners[injectorName].onConnectionError;
                if (connectionErrorCallback)
                    connectionErrorCallback();
            }
            catch (e)
            {
                ns.Log(e);
            }
        }

        function StartInjector(param)
        {
            var pluginStartData = {};
            var runner = runners[param.injectorName];
            if (runner && runner.getParameters)
                pluginStartData = { plugin: runner, parameters: ns.JSONStringify(runner.getParameters()) };

            var startData =
                {
                    url: ns.StartLocationHref,
                    plugins: param.injectorName,
                    data: { data: pluginStartData },
                    isTopLevel: ns.IsTopLevel,
                    pageStartTime: ns.GetPageStartTime(),
                    navigationStartTime: ns.GetPageStartNavigationTime()
                };

            m_caller.StartCall(
                startData,
                function StartCallCallback(plugin)
                {
                    if (runner && plugin)
                    {
                        var settings = ns.IsDefined(plugin.settingsJson) ? SettingsObjectFromSettingsJson(plugin.settingsJson) : plugin.settings;
                        var localization = ns.IsDefined(plugin.localizationDictionary) ? LocalizationObjectFromDictionary(plugin.localizationDictionary) : {};
                        runner.runner(AvNs, avSessionInstance, settings, localization);
                    }
                },
                function StartCallOnError()
                { 
                    OnStartError(param.injectorName);
                }
                );
        }

        function OnStopError(injectorName)
        {
            ns.Log("Stop " + injectorName + "injector failed");
        }

        function StopInjector(param)
        {
            var runner = runners[param.injectorName];

            m_caller.StopCall(
                param.injectorName,
                function StopCallCallback(plugin)
                {
                    try
                    {
                        if (runner && plugin && runner.stop)
                            runner.stop(AvNs, avSessionInstance);
                    }
                    catch (e)
                    {
                        ns.SessionError(e, plugin);
                    }
                },
                function StopCallOnError() { OnStopError(param.injectorName); }
                );
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
                msg = ns.JSONStringify(error);
            }
            else
            {
                msg = String(error);
            }
            return msg.length <= 2048 ? msg : (msg.substring(0, 2048) + "<...>");
        }

        function ExtractStackWithRegexp(stack, regexp)
        {
            const resultArray = [...stack.matchAll(regexp)];
            return resultArray.map(m => m[1]);
        }

        function ExtractStack(error)
        {
            if (!error.stack)
                return "";

            const extractedStack = ExtractStackWithRegexp(error.stack, /at ([\w\s.]*) \(chrome-extension:\/\/\w*((?:\/[\w.]*)*(?::\d*){2})\)/g);
            if (extractedStack)
                return extractedStack.join("\n");

            return error.stack;
        }

        RegisterMethod("redirect", Redirect);
        RegisterMethod("reload", ReloadPage);
        RegisterMethod("start", StartInjector);
        RegisterMethod("stop", StopInjector);


        this.Reload = function Reload()
        {
            ReloadPage();
        };

        this.Log = function Log(error)
        {
            try
            {
                if (!(this.IsProductConnected() && enableTracing))
                    return;

                m_caller.SendLog(GetErrorMessage(error));
            }
            catch (e)
            {
                ns.Log(e.message || e);
            }
        };

        this.LogError = function LogError(error, injector)
        {
            try
            {
                if (!m_callReceiver.IsProductConnected())
                    return;
                if (!injector)
                    injector = "common"; 

                var result = { injector: injector };
                var details = { topLevel: ns.IsTopLevel };

                if (typeof error === "object")
                {
                    result.error2 = error.message ? error.message : "unknown";
                    result.stack = ExtractStack(error);
                    details.errorDetails = error.details;
                    result.error = result.error2;
                    if (details.errorDetails)
                    {
                        result.error += "\n" + (typeof details.errorDetails === "object")
                            ? ns.JSONStringify(details.errorDetails)
                            : details.errorDetails;
                    }
                    if (result.stack)
                        result.error += "\n" + result.stack;
                }
                else
                {
                    result.error  = error;
                    var m = ns.StringSplit.call(error, "\n");
                    result.error2 = m[0];
                    details.errorDetails = m.slice(1).join("\n");
                }
                details.manifestVersion = browsersApi.runtime.getManifest().version;

                result.details = ns.JSONStringify(details);
                m_caller.SessionErrorCall(ns.JSONStringify(result));
            }
            catch (e)
            {
                ns.Log(e.message || e);
            }
        };
        function IsNeedSkipError()
        {
            return true;
        }

        this.UnhandledException = function UnhandledException(e)
        {
            try
            {
                if (IsNeedSkipError(e))
                    return;

                var errInfo = {};
                errInfo.error = e.message && e.message.length > 1024 ? (e.message.substring(0, 1019) + "<...>") : e.message;
                errInfo.script = e.filename && e.filename.length > 1024 ? (e.filename.substring(0, 1019) + "<...>") : e.filename;
                errInfo.line = e.lineno;
                errInfo.column = e.colno;
                if (e.error)
                    errInfo.stack = e.error.stack && e.error.stack.length > 2048 ? (e.error.stack.substring(0, 2043) + "<...>") : e.error.stack;

                m_caller.UnhandledExceptionCall(ns.JSONStringify(errInfo));
                return;
            }
            catch (ex)
            {
                ns.Log(ex.message || ex);
            }
        };

        this.ForceReceive = function ForceReceive()
        {
            m_callReceiver.ForceReceive();
        };

        this.IsProductConnected = function IsProductConnected()
        {
            return m_callReceiver.IsProductConnected();
        };

        this.InitializePlugin = function InitializePlugin(init)
        {
            init(
                function OnInitActivatePlugin()
                {
                    ActivatePlugin.apply(self, arguments);
                },
                function OnInitRegisterMethod()
                {
                    RegisterMethod.apply(self, arguments);
                },
                function OnInitCall()
                {
                    Call.apply(self, arguments);
                },
                function OnInitDeactivatePlugin()
                {
                    DeactivatePlugin.apply(self, arguments);
                },
                function OnInitOnUnloadCall()
                {
                    return OnUnloadCall.apply(self, arguments);
                }
            );
        };

        this.GetResource = function GetResource(resourcePostfix, callbackSuccess, callbackError)
        {
            if (!m_caller.ResourceCall)
                throw new Error("Not implemented on transport GetResource");

            m_caller.ResourceCall(resourcePostfix, callbackSuccess, callbackError);
        };

        this.Stop = function Stop(reason)
        {
            StopImpl(reason);
        };
    };

    ns.AddRunner = function AddRunner(pluginName, runnerFunc, initParameters, onConnectionError)
    {
        var options = {
            name: pluginName,
            runner: runnerFunc
        };
        if (initParameters)
            options.getParameters = function getParameters() { return initParameters; };
        if (onConnectionError)
            options.onConnectionError = onConnectionError;
        ns.AddRunner2(options);
    };

    ns.AddRunner2 = function AddRunner2(options)
    {
        var runnerItem = {
            isRunning: false,
            runner: (...args) =>
                {
                    options.runner(...args);
                    this.isRunning = true;
                }
        };
        if (options.stop)
        {
            runnerItem.stop = (...args) =>
                {
                    if (this.isRunning)
                    {
                        options.stop(...args);
                        this.isRunning = false;
                    }
                };
        }
        if (options.onConnectionError)
            runnerItem.onConnectionError = options.onConnectionError;
        if (options.getParameters)
            runnerItem.getParameters = options.getParameters;
        if (options.reject)
            runnerItem.reject = options.reject;
        runners[options.name] = runnerItem;
    };

    ns.SessionLog = function SessionLog(e)
    {
        if (avSessionInstance)
        {
            avSessionInstance.Log(e);
            return;
        }

        ns.Log(e);
        ns.NmsLog(e);
    };

    ns.SessionError = function SessionError(e, injector)
    {
        if (avSessionInstance && avSessionInstance.IsProductConnected())
            avSessionInstance.LogError(e, injector);
        else
            ns.Log(e);
    };


    ns.ContentSecurityPolicyNonceAttribute = ns.CSP_NONCE;

    function Init()
    {
        if (initPending || sessionMarkedForbidden)
            return;

        if (avSessionInstance && avSessionInstance.IsProductConnected())
            return;

        initPending = true;

        var caller = new ns.Caller();
        caller.Start(
            function StartCallback() 
            {
                var injectors = "";
                var pluginsInitData = [];
                var injectorNames = [];
                for (var runner in runners)
                {
                    if (!ns.ObjectHasOwnProperty.call(runners, runner))
                        continue;

                    if (injectors)
                        injectors += "&";
                    injectors += runner;
                    injectorNames.push(runner);

                    if (runners[runner].getParameters)
                        pluginsInitData.push({ plugin: runner, parameters: ns.JSONStringify(runners[runner].getParameters()) });
                }

                var initData = 
                    {
                        url: ns.StartLocationHref,
                        plugins: injectors,
                        data: { data: pluginsInitData },
                        isTopLevel: ns.IsTopLevel,
                        pageStartTime: ns.GetPageStartTime(),
                        navigationStartTime: ns.GetPageStartNavigationTime()
                    };

                caller.InitCall(
                    initData,
                    function InitCallCallback(initSettings)
                    {
                        ns.IsRtl = initSettings.rtl;
                        enableTracing = ns.IsDefined(initSettings.enableTracing) ? initSettings.enableTracing : true;
                        avSessionInstance = new AvSessionClass(caller);
                        var plugins = initSettings.plugins || [];
                        for (var i = 0, pluginsCount = plugins.length; i < pluginsCount; ++i)
                        {
                            try
                            {
                                var plugin = plugins[i];
                                var runnerItem = runners[plugin.name];

                                if (runnerItem)
                                {
                                    var settings = ns.IsDefined(plugin.settingsJson) ? SettingsObjectFromSettingsJson(plugin.settingsJson) : plugin.settings;
                                    var localization = ns.IsDefined(plugin.localizationDictionary) 
                                        ? LocalizationObjectFromDictionary(plugin.localizationDictionary) 
                                        : plugin.localization;
                                    runnerItem.runner(AvNs, avSessionInstance, settings, localization);
                                }
                            }
                            catch (e)
                            {
                                e.message = "Init error: " + e.message;
                                ns.SessionError(e, plugins[i].name);
                            }
                        }
                        for (var j = 0; j < injectorNames.length; ++j)
                        {
                            try
                            {
                                var injectorName = injectorNames[j];
                                var runnerItemHolder = runners[injectorName];
                                if (!IsInjectorInActiveList(plugins, injectorName) && runnerItemHolder.reject)
                                    runnerItemHolder.reject();
                            }
                            catch (e)
                            {
                                ns.SessionError(e);
                            }
                        }

                        initPending = false;
                        ns.SessionLog(`Session: ${initSettings.sessionId} initialization complete time: ${ns.GetCurrentIsoDate()}`);
                    },
                    OnInitError
                    );
            },
            OnInitError
            );
    }

    function IsInjectorInActiveList(plugins, injectorName)
    {
        for (var i = 0; i < plugins.length; ++i)
        {
            if (plugins[i].name === injectorName)
                return true;
        }
        return false;
    }

    function PostponeInit()
    {
        var nowPostponeTime = ns.GetCurrentTime();
        var postponeDelay = (nowPostponeTime - lastPostponedInitTime) > 5000 ? 200 : 60 * 1000;
        lastPostponedInitTime = nowPostponeTime;
        ns.ClearTimeout(postponedInitTimeout);
        postponedInitTimeout = ns.SetTimeout(Init, postponeDelay);
    }

    function OnInitError(message, details)
    {
        if (details && details.forbidden)
        {
            ns.ClearInterval(restartInterval);
            restartInterval = 0;
            sessionMarkedForbidden = true;
        }
        else
        {
            PostponeInit();
        }

        for (var runner in runners)
        {
            if (!ns.ObjectHasOwnProperty.call(runners, runner))
                continue;
            try
            {
                var connectionErrorCallback = runners[runner].onConnectionError;
                if (connectionErrorCallback)
                    connectionErrorCallback();
            }
            catch (e)
            {
                AvNs.SessionLog(e);
            }
        }

        initPending = false;
    }

    ns.StartSession = function StartSession()
    {
        ns.ClearInterval(restartInterval);
        restartInterval = ns.SetInterval(PostponeInit, 30000);        
        Init();
    };

    ns.StopSession = function StopSession(reason)
    {
        if (avSessionInstance)
            avSessionInstance.Stop(reason);
    };

})(AvNs);
