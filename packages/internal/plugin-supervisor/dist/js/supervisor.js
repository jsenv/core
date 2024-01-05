window.__supervisor__ = (() => {
  const notImplemented = () => {
    throw new Error("window.__supervisor__.setup() not called");
  };
  const supervisor = {
    reportException: notImplemented,
    superviseScript: notImplemented,
    superviseScriptTypeModule: notImplemented,
    reloadSupervisedScript: notImplemented,
    getDocumentExecutionResult: notImplemented
  };
  const isWebkitOrSafari = typeof window.webkitConvertPointFromNodeToPage === "function";
  const executionResults = {};
  let documentExecutionStartTime;
  try {
    documentExecutionStartTime = window.performance.timing.navigationStart;
  } catch (e) {
    documentExecutionStartTime = Date.now();
  }
  let documentExecutionEndTime;
  supervisor.setup = ({
    rootDirectoryUrl,
    scriptInfos,
    serverIsJsenvDevServer,
    logs,
    errorOverlay,
    errorBaseUrl,
    openInEditor
  }) => {
    const executions = {};
    const promises = [];
    let remainingScriptCount = scriptInfos.length;

    // respect execution order
    // - wait for classic scripts to be done (non async)
    // - wait module script previous execution (non async)
    // see https://gist.github.com/jakub-g/385ee6b41085303a53ad92c7c8afd7a6#typemodule-vs-non-module-typetextjavascript-vs-script-nomodule
    const executionQueue = [];
    let executing = false;
    const addToExecutionQueue = async execution => {
      if (execution.async) {
        execution.execute();
        return;
      }
      if (executing) {
        executionQueue.push(execution);
        return;
      }
      execThenDequeue(execution);
    };
    const execThenDequeue = async execution => {
      executing = true;
      // start next js module execution as soon as current js module starts to execute
      // (do not wait in case of top level await)
      let resolveExecutingPromise;
      const executingPromise = new Promise(resolve => {
        resolveExecutingPromise = resolve;
      });
      const promise = execution.execute({
        onExecuting: () => resolveExecutingPromise()
      });
      await Promise.race([promise, executingPromise]);
      executing = false;
      if (executionQueue.length) {
        const nextExecution = executionQueue.shift();
        execThenDequeue(nextExecution);
      }
    };
    const asExecutionId = src => {
      const url = new URL(src, window.location).href;
      if (url.startsWith(window.location.origin)) {
        return src;
      }
      return url;
    };
    const createExecutionController = (src, type) => {
      const result = {
        status: "pending",
        duration: null,
        coverage: null,
        exception: null,
        value: null
      };
      let resolve;
      const promise = new Promise(_resolve => {
        resolve = _resolve;
      });
      promises.push(promise);
      executionResults[src] = result;
      const start = () => {
        result.duration = null;
        result.coverage = null;
        result.status = "started";
        result.exception = null;
        if (logs) {
          console.group("[jsenv] ".concat(src, " execution started (").concat(type, ")"));
        }
      };
      const end = () => {
        const now = Date.now();
        remainingScriptCount--;
        result.duration = now - documentExecutionStartTime;
        result.coverage = window.__coverage__;
        if (logs) {
          console.log("execution ".concat(result.status));
          console.groupEnd();
        }
        if (remainingScriptCount === 0) {
          documentExecutionEndTime = now;
        }
        resolve();
      };
      const complete = () => {
        result.status = "completed";
        end();
      };
      const fail = (error, info) => {
        result.status = "failed";
        const exception = supervisor.createException(error, info);
        result.exception = exception;
        end();
      };
      return {
        result,
        start,
        complete,
        fail
      };
    };
    const prepareJsClassicRemoteExecution = src => {
      const urlObject = new URL(src, window.location);
      const url = urlObject.href;
      const {
        result,
        start,
        complete,
        fail
      } = createExecutionController(src, "js_classic");
      let parentNode;
      let currentScript;
      let nodeToReplace;
      let currentScriptClone;
      const init = () => {
        currentScript = document.currentScript;
        parentNode = currentScript.parentNode;
        executions[src].async = currentScript.async;
      };
      const execute = async ({
        isReload
      } = {}) => {
        start();
        currentScriptClone = prepareScriptToLoad(currentScript);
        if (isReload) {
          urlObject.searchParams.set("hot", Date.now());
          nodeToReplace = currentScriptClone;
          currentScriptClone.src = urlObject.href;
        } else {
          nodeToReplace = currentScript;
          currentScriptClone.src = url;
        }
        const scriptLoadPromise = getScriptLoadPromise(currentScriptClone);
        parentNode.replaceChild(currentScriptClone, nodeToReplace);
        const {
          detectedBy,
          failed,
          errorEvent
        } = await scriptLoadPromise;
        if (failed) {
          const messageDefault = "Error while loading script";
          const {
            error,
            message,
            filename,
            lineno,
            colno
          } = errorEvent;
          if (detectedBy === "script_error_event") {
            // window.error won't be dispatched for this error
            reportErrorBackToBrowser(error || errorEvent);
          }
          fail(error || message || messageDefault, {
            message: messageDefault,
            reportedBy: "script_error_event",
            url: filename || urlObject.href,
            line: lineno,
            column: colno
          });
          if (detectedBy === "script_error_event") {
            supervisor.reportException(result.exception);
          }
        } else {
          complete();
        }
        return result;
      };
      executions[src] = {
        init,
        execute
      };
    };
    const prepareJsClassicInlineExecution = src => {
      const {
        start,
        complete,
        fail
      } = createExecutionController(src, "js_classic");
      const end = complete;
      const error = e => {
        reportErrorBackToBrowser(e); // supervision shallowed the error, report back to browser
        fail(e);
      };
      executions[src] = {
        isInline: true,
        start,
        end,
        error
      };
    };

    // https://twitter.com/damienmaillard/status/1554752482273787906
    const prepareJsModuleExecutionWithDynamicImport = src => {
      const urlObject = new URL(src, window.location);
      const {
        result,
        start,
        complete,
        fail
      } = createExecutionController(src, "js_classic");
      let importFn;
      let currentScript;
      const init = _importFn => {
        importFn = _importFn;
        currentScript = document.querySelector("script[type=\"module\"][inlined-from-src=\"".concat(src, "\"]"));
        executions[src].async = currentScript.async;
      };
      const execute = async ({
        isReload
      } = {}) => {
        start();
        if (isReload) {
          urlObject.searchParams.set("hot", Date.now());
        }
        try {
          const namespace = await importFn(urlObject.href);
          complete(namespace);
          return result;
        } catch (e) {
          fail(e, {
            message: "Error while importing module",
            reportedBy: "dynamic_import",
            url: urlObject.href
          });
          if (isWebkitOrSafari) {
            supervisor.reportException(result.exception);
          }
          return result;
        }
      };
      executions[src] = {
        init,
        execute
      };
    };
    const prepareJsModuleExecutionWithScriptThenDynamicImport = src => {
      const urlObject = new URL(src, window.location);
      const {
        result,
        start,
        complete,
        fail
      } = createExecutionController(src, "js_module");
      let importFn;
      let currentScript;
      let parentNode;
      let nodeToReplace;
      let currentScriptClone;
      const init = _importFn => {
        importFn = _importFn;
        currentScript = document.querySelector("script[type=\"module\"][inlined-from-src=\"".concat(src, "\"]"));
        parentNode = currentScript.parentNode;
        executions[src].async = currentScript.async;
      };
      const execute = async ({
        isReload,
        onExecuting = () => {}
      } = {}) => {
        start();
        currentScriptClone = prepareScriptToLoad(currentScript);
        if (isReload) {
          urlObject.searchParams.set("hot", Date.now());
          nodeToReplace = currentScriptClone;
          currentScriptClone.src = urlObject.href;
        } else {
          nodeToReplace = currentScript;
          currentScriptClone.src = urlObject.href;
        }
        const scriptLoadResultPromise = getScriptLoadPromise(currentScriptClone);
        parentNode.replaceChild(currentScriptClone, nodeToReplace);
        const {
          detectedBy,
          failed,
          errorEvent
        } = await scriptLoadResultPromise;
        if (failed) {
          const messageDefault = "Error while loading module";
          const {
            error,
            message,
            filename,
            lineno,
            colno
          } = errorEvent;
          // if (detectedBy === "script_error_event") {
          //   reportErrorBackToBrowser(error)
          // }
          fail(error || message || messageDefault, {
            message: messageDefault,
            reportedBy: "script_error_event",
            url: filename || urlObject.href,
            line: lineno,
            column: colno
          });
          if (detectedBy === "script_error_event") {
            supervisor.reportException(result.exception);
          }
          return result;
        }
        onExecuting();
        result.status = "executing";
        if (logs) {
          console.log("load ended");
        }
        try {
          const namespace = await importFn(urlObject.href);
          complete(namespace);
          return result;
        } catch (e) {
          fail(e, {
            message: "Error while importing module: ".concat(urlObject.href),
            reportedBy: "dynamic_import",
            url: urlObject.href
          });
          return result;
        }
      };
      executions[src] = {
        init,
        execute
      };
    };
    const prepareJsModuleRemoteExecution = isWebkitOrSafari ? prepareJsModuleExecutionWithDynamicImport : prepareJsModuleExecutionWithScriptThenDynamicImport;
    const prepareJsModuleInlineExecution = src => {
      const {
        start,
        complete,
        fail
      } = createExecutionController(src, "js_module");
      const end = complete;
      const error = e => {
        // supervision shallowed the error, report back to browser
        reportErrorBackToBrowser(e);
        fail(e);
      };
      executions[src] = {
        isInline: true,
        start,
        end,
        error
      };
    };
    supervisor.setupReportException({
      logs,
      serverIsJsenvDevServer,
      rootDirectoryUrl,
      errorOverlay,
      errorBaseUrl,
      openInEditor
    });
    scriptInfos.forEach(scriptInfo => {
      const {
        type,
        src,
        isInline
      } = scriptInfo;
      if (type === "js_module") {
        if (isInline) {
          prepareJsModuleInlineExecution(src);
        } else {
          prepareJsModuleRemoteExecution(src);
        }
      } else if (isInline) {
        prepareJsClassicInlineExecution(src);
      } else {
        prepareJsClassicRemoteExecution(src);
      }
    });

    // js classic
    supervisor.jsClassicStart = inlineSrc => {
      executions[inlineSrc].start();
    };
    supervisor.jsClassicEnd = inlineSrc => {
      executions[inlineSrc].end();
    };
    supervisor.jsClassicError = (inlineSrc, e) => {
      executions[inlineSrc].error(e);
    };
    supervisor.superviseScript = src => {
      const execution = executions[asExecutionId(src)];
      execution.init();
      return addToExecutionQueue(execution);
    };
    // js module
    supervisor.jsModuleStart = inlineSrc => {
      executions[inlineSrc].start();
    };
    supervisor.jsModuleEnd = inlineSrc => {
      executions[inlineSrc].end();
    };
    supervisor.jsModuleError = (inlineSrc, e) => {
      executions[inlineSrc].error(e);
    };
    supervisor.superviseScriptTypeModule = (src, importFn) => {
      const execution = executions[asExecutionId(src)];
      execution.init(importFn);
      return addToExecutionQueue(execution);
    };
    supervisor.reloadSupervisedScript = src => {
      const execution = executions[src];
      if (!execution) {
        throw new Error("no execution for ".concat(src));
      }
      if (execution.isInline) {
        throw new Error("cannot reload inline script ".concat(src));
      }
      return execution.execute({
        isReload: true
      });
    };
    supervisor.getDocumentExecutionResult = async () => {
      await Promise.all(promises);
      return {
        startTime: documentExecutionStartTime,
        endTime: documentExecutionEndTime,
        status: "completed",
        executionResults
      };
    };
  };
  const reportErrorBackToBrowser = error => {
    if (typeof window.reportError === "function") {
      window.reportError(error);
    } else {
      console.error(error);
    }
  };
  supervisor.setupReportException = ({
    logs,
    rootDirectoryUrl,
    serverIsJsenvDevServer,
    errorNotification,
    errorOverlay,
    errorBaseUrl,
    openInEditor
  }) => {
    const DYNAMIC_IMPORT_FETCH_ERROR = "dynamic_import_fetch_error";
    const DYNAMIC_IMPORT_EXPORT_MISSING = "dynamic_import_export_missing";
    const DYNAMIC_IMPORT_SYNTAX_ERROR = "dynamic_import_syntax_error";
    const createException = (reason,
    // can be error, string, object
    {
      message,
      reportedBy,
      url,
      line,
      column
    } = {}) => {
      const exception = {
        reason,
        isException: true,
        isError: false,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw
        reportedBy,
        code: null,
        name: null,
        message: null,
        stack: "",
        // the stack v8 format
        stackSourcemapped: null,
        stackOriginal: "",
        // the stack from runtime, not normalized to v8
        stackTrace: "",
        // the stack trace (without error name and message)
        stackFrames: undefined,
        withServerUrls: {
          message: "",
          stack: "",
          stackTrace: ""
        },
        meta: null,
        site: {
          isInline: null,
          url: null,
          line: null,
          column: null,
          originalUrl: null
        }
      };
      const writeBasicProperties = () => {
        if (reason === undefined) {
          exception.message = "undefined";
          return;
        }
        if (reason === null) {
          exception.message = "null";
          return;
        }
        if (typeof reason === "string") {
          exception.message = reason;
          return;
        }
        if (typeof reason !== "object") {
          exception.message = JSON.stringify(reason);
          return;
        }
        // isError can be false when reason is an ErrorEvent for instance
        exception.isError = reason instanceof Error;
        exception.name = reason.name || "Error";
        exception.message = reason.message || message || "";
        let stackFrames;
        if (exception.isError && Error.captureStackTrace &&
        // captureStackTrace exists on webkit but error.stack is not v8
        !isWebkitOrSafari) {
          // stackTrace formatted by V8
          const {
            prepareStackTrace
          } = Error;
          Error.prepareStackTrace = (e, callSites) => {
            Error.prepareStackTrace = prepareStackTrace;
            const getPropertiesFromEvalOrigin = origin => {
              // Most eval() calls are in this format
              const topLevelEvalMatch = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(origin);
              if (topLevelEvalMatch) {
                const source = topLevelEvalMatch[2];
                const line = Number(topLevelEvalMatch[3]);
                const column = topLevelEvalMatch[4] - 1;
                return {
                  url: source,
                  line,
                  column
                };
              }
              // Parse nested eval() calls using recursion
              const nestedEvalMatch = /^eval at ([^(]+) \((.+)\)$/.exec(origin);
              if (nestedEvalMatch) {
                return getPropertiesFromEvalOrigin(nestedEvalMatch[2]);
              }
              return null;
            };
            stackFrames = [];
            for (const callSite of callSites) {
              const url = callSite.getFileName() || callSite.getScriptNameOrSourceURL();
              const line = callSite.getLineNumber();
              const column = callSite.getColumnNumber();
              const site = resolveUrlSite({
                url,
                line,
                column
              });
              const stackFrame = {
                raw: "  at ".concat(String(callSite)),
                url: site.url,
                line: site.line,
                column: site.column,
                functionName: callSite.getFunctionName(),
                isNative: callSite.isNative(),
                isEval: callSite.isEval(),
                isConstructor: callSite.isConstructor(),
                isAsync: callSite.isAsync(),
                evalSite: null
              };
              if (stackFrame.isEval) {
                const evalOrigin = stackFrame.getEvalOrigin();
                if (evalOrigin) {
                  stackFrame.evalSite = getPropertiesFromEvalOrigin(evalOrigin);
                }
              }
              stackFrames.push(stackFrame);
            }
            let stackTrace = "";
            for (const stackFrame of stackFrames) {
              if (stackTrace) stackTrace += "\n";
              stackTrace += stackFrame.raw;
            }
            exception.stackTrace = stackTrace;
            let stack = "";
            const name = reason.name || "Error";
            const message = reason.message || "";
            stack += "".concat(name, ": ").concat(message);
            if (stackTrace) {
              stack += "\n".concat(stackTrace);
            }
            return stack;
          };
          exception.stackSourcemapped = true;
          exception.stack = reason.stack;
          if (stackFrames === undefined) {
            // Error.prepareStackTrace not trigerred
            // - reason is not an error
            // - reason.stack already get
            Error.prepareStackTrace = prepareStackTrace;
            exception.stackTrace = getErrorStackTrace(reason);
          } else {
            exception.stackFrames = stackFrames;
            const [firstCallFrame] = stackFrames;
            if (exception.site.url === null && firstCallFrame && firstCallFrame.url) {
              Object.assign(exception.site, {
                url: firstCallFrame.url,
                line: firstCallFrame.line,
                column: firstCallFrame.column
              });
            }
          }
        } else {
          exception.stackSourcemapped = false;
          exception.stackTrace = reason.stack;
          exception.stack = stringifyStack(exception);
        }
        if (exception.site.url === null && reason.url) {
          Object.assign(exception.site, resolveUrlSite({
            url: reason.url
          }));
        }
        {
          // chrome
          if (exception.message.includes("does not provide an export named")) {
            exception.code = DYNAMIC_IMPORT_EXPORT_MISSING;
          }
          // firefox
          if (exception.message.startsWith("import not found:") || exception.message.startsWith("ambiguous indirect export:")) {
            exception.code = DYNAMIC_IMPORT_EXPORT_MISSING;
          }
          // safari
          if (exception.message.startsWith("import binding name")) {
            exception.code = DYNAMIC_IMPORT_EXPORT_MISSING;
          }
          if (exception.message.includes("Importing a module script failed")) {
            exception.code = DYNAMIC_IMPORT_FETCH_ERROR;
          }
        }
        {
          if (!exception.code && exception.name === "SyntaxError" && typeof line === "number") {
            exception.code = DYNAMIC_IMPORT_SYNTAX_ERROR;
          }
        }
      };
      writeBasicProperties();

      // then if it fails, use url+line+column passed
      if (exception.site.url === null && url) {
        if (typeof line === "string") {
          line = parseInt(line);
        }
        if (typeof column === "string") {
          column = parseInt(column);
        }
        const fileUrlSite = resolveUrlSite({
          url,
          line,
          column
        });
        if (fileUrlSite.isInline && exception.name === "SyntaxError" && exception.code !== DYNAMIC_IMPORT_EXPORT_MISSING) {
          // syntax error on inline script need line-1 for some reason
          fileUrlSite.line = fileUrlSite.line - 1;
        }
        Object.assign(exception.site, fileUrlSite);
      }
      exception.withServerUrls.message = exception.message;
      exception.withServerUrls.stackTrace = exception.stackTrace;
      exception.withServerUrls.stack = exception.stack;
      exception.message = exception.message ? replaceUrls(exception.message, serverUrlSite => {
        const fileUrlSite = resolveUrlSite(serverUrlSite);
        return stringifyUrlSite(fileUrlSite);
      }) : "";
      exception.stackTrace = exception.stackTrace ? replaceUrls(exception.stackTrace, serverUrlSite => {
        const fileUrlSite = resolveUrlSite(serverUrlSite);
        if (exception.site.url === null) {
          Object.assign(exception.site, fileUrlSite);
        }
        return stringifyUrlSite(fileUrlSite);
      }) : "";
      exception.stack = stringifyStack({
        name: exception.name,
        message: exception.message,
        stackTrace: exception.stackTrace
      });
      exception.text = stringifyStack({
        name: exception.name,
        message: exception.message,
        stackTrace: exception.stackTrace
      });
      return exception;
    };
    const stringifyStack = ({
      codeFrame,
      name,
      message,
      stackTrace
    }) => {
      let stack = "";
      if (codeFrame) {
        stack += "".concat(codeFrame, "\n");
      }
      if (name && message) {
        stack += "".concat(name, ": ").concat(message);
      } else if (message) {
        stack += message;
      }
      if (stackTrace) {
        stack += "\n".concat(stackTrace);
      }
      return stack;
    };
    const stringifyUrlSite = ({
      url,
      line,
      column
    }) => {
      if (typeof line === "number" && typeof column === "number") {
        return "".concat(url, ":").concat(line, ":").concat(column);
      }
      if (typeof line === "number") {
        return "".concat(url, ":").concat(line);
      }
      return url;
    };
    const resolveUrlSite = ({
      url,
      line,
      column
    }) => {
      const inlineUrlMatch = url.match(/@L([0-9]+)C([0-9]+)\-L([0-9]+)C([0-9]+)(\.[\w]+)$/);
      if (inlineUrlMatch) {
        const htmlUrl = url.slice(0, inlineUrlMatch.index);
        const tagLineStart = parseInt(inlineUrlMatch[1]);
        const tagColumnStart = parseInt(inlineUrlMatch[2]);
        const tagLineEnd = parseInt(inlineUrlMatch[3]);
        const tagColumnEnd = parseInt(inlineUrlMatch[4]);
        const extension = inlineUrlMatch[5];
        url = htmlUrl;
        line = tagLineStart + (typeof line === "number" ? line : 0);
        line = line - 1; // sauf pour les erreur de syntaxe
        column = tagColumnStart + (typeof column === "number" ? column : 0);
        const fileUrl = resolveFileUrl(url);
        return {
          isInline: true,
          serverUrl: url,
          originalUrl: "".concat(fileUrl, "@L").concat(tagLineStart, "C").concat(tagColumnStart, "-L").concat(tagLineEnd, "C").concat(tagColumnEnd).concat(extension),
          url: fileUrl,
          line,
          column
        };
      }
      return {
        isInline: false,
        serverUrl: url,
        url: resolveFileUrl(url),
        line,
        column
      };
    };
    const getErrorStackTrace = error => {
      let stack = error.stack;
      if (!stack) return "";
      const messageInStack = "".concat(error.name, ": ").concat(error.message);
      if (stack.startsWith(messageInStack)) {
        stack = stack.slice(messageInStack.length);
      }
      const nextLineIndex = stack.indexOf("\n");
      if (nextLineIndex > -1) {
        stack = stack.slice(nextLineIndex + 1);
      }
      return stack;
    };
    const resolveFileUrl = url => {
      let urlObject;
      try {
        urlObject = new URL(url, window.origin);
      } catch (e) {
        return url;
      }
      if (urlObject.origin === window.origin) {
        urlObject = new URL("".concat(urlObject.pathname.slice(1)).concat(urlObject.search), rootDirectoryUrl);
      }
      if (urlObject.href.startsWith("file:")) {
        const atFsIndex = urlObject.pathname.indexOf("/@fs/");
        if (atFsIndex > -1) {
          const afterAtFs = urlObject.pathname.slice(atFsIndex + "/@fs/".length);
          return new URL(afterAtFs, "file:///").href;
        }
      }
      return urlObject.href;
    };

    // `Error: yo
    // at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
    // at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
    // at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
    // at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
    //   debugger
    // })
    const replaceUrls = (source, replace) => {
      return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, match => {
        let replacement = "";
        const lastChar = match[match.length - 1];

        // hotfix because our url regex sucks a bit
        const endsWithSeparationChar = lastChar === ")" || lastChar === ":";
        if (endsWithSeparationChar) {
          match = match.slice(0, -1);
        }
        const lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
        const lineAndColumMatch = match.match(lineAndColumnPattern);
        if (lineAndColumMatch) {
          const lineAndColumnString = lineAndColumMatch[0];
          const lineString = lineAndColumMatch[1];
          const columnString = lineAndColumMatch[2];
          replacement = replace({
            url: match.slice(0, -lineAndColumnString.length),
            line: lineString ? parseInt(lineString) : null,
            column: columnString ? parseInt(columnString) : null
          });
        } else {
          const linePattern = /:([0-9]+)$/;
          const lineMatch = match.match(linePattern);
          if (lineMatch) {
            const lineString = lineMatch[0];
            replacement = replace({
              url: match.slice(0, -lineString.length),
              line: lineString ? parseInt(lineString) : null
            });
          } else {
            replacement = replace({
              url: match
            });
          }
        }
        if (endsWithSeparationChar) {
          return "".concat(replacement).concat(lastChar);
        }
        return replacement;
      });
    };
    let displayErrorNotification;
    {
      const {
        Notification
      } = window;
      displayErrorNotification = typeof Notification === "function" ? ({
        title,
        text,
        icon
      }) => {
        if (Notification.permission === "granted") {
          const notification = new Notification(title, {
            lang: "en",
            body: text,
            icon
          });
          notification.onclick = () => {
            window.focus();
          };
        }
      } : () => {};
    }
    const JSENV_ERROR_OVERLAY_TAGNAME = "jsenv-error-overlay";
    let displayJsenvErrorOverlay;
    {
      displayJsenvErrorOverlay = params => {
        if (logs) {
          console.log("display jsenv error overlay", params);
        }
        let jsenvErrorOverlay = new JsenvErrorOverlay(params);
        document.querySelectorAll(JSENV_ERROR_OVERLAY_TAGNAME).forEach(node => {
          node.parentNode.removeChild(node);
        });
        document.body.appendChild(jsenvErrorOverlay);
        const removeErrorOverlay = () => {
          if (jsenvErrorOverlay && jsenvErrorOverlay.parentNode) {
            document.body.removeChild(jsenvErrorOverlay);
            jsenvErrorOverlay = null;
          }
        };
        return removeErrorOverlay;
      };
      class JsenvErrorOverlay extends HTMLElement {
        constructor(exception) {
          super();
          const root = this.attachShadow({
            mode: "open"
          });
          const tips = [];
          tips.push("Click outside to close.");
          const tip = tips.join("\n    <br />\n    ");
          root.innerHTML = "\n<style>\n  ".concat(overlayCSS, "\n</style>\n<div class=\"backdrop\"></div>\n<div class=\"overlay\" data-theme=\"dark\">\n  <h1 class=\"title\">\n    An error occured\n  </h1>\n  <pre class=\"text\"></pre>\n  <div class=\"tip\">\n    ").concat(tip, "\n  </div>\n</div>");
          root.querySelector(".backdrop").onclick = () => {
            if (!this.parentNode) {
              // not in document anymore
              return;
            }
            root.querySelector(".backdrop").onclick = null;
            this.parentNode.removeChild(this);
          };
          const renderException = () => {
            const {
              cause = {}
            } = exception;
            const {
              trace = {}
            } = cause;
            root.querySelector(".text").innerHTML = stringifyStack({
              codeFrame: trace.codeFrame ? generateClickableText(trace.codeFrame) : "",
              name: exception.name,
              message: exception.message ? generateClickableText(exception.message) : "",
              stackTrace: exception.stackTrace ? generateClickableText(exception.stackTrace) : ""
            });
            if (cause) {
              const causeText = stringifyStack({
                name: cause.name,
                message: cause.reason ? generateClickableText(cause.reason) : cause.stack ? generateClickableText(cause.stack) : ""
              });
              if (causeText) {
                const causeTextIndented = prefixRemainingLines(causeText, "  ");
                root.querySelector(".text").innerHTML += "\n  [cause]: ".concat(causeTextIndented);
              }
            }
            if (exception.reportedBy === "script_error_event" || exception.reportedBy === "window_error_event" || exception.name === "SyntaxError" || exception.code === DYNAMIC_IMPORT_FETCH_ERROR || exception.code === DYNAMIC_IMPORT_EXPORT_MISSING || exception.code === DYNAMIC_IMPORT_SYNTAX_ERROR) {
              let traceSite = stringifyUrlSite(trace);
              if (traceSite) {
                root.querySelector(".text").innerHTML += "\n  at ".concat(generateClickableText(traceSite));
              }
            }
          };
          renderException();
          if (exception.site.url && serverIsJsenvDevServer) {
            (async () => {
              try {
                if (exception.code === DYNAMIC_IMPORT_FETCH_ERROR || exception.reportedBy === "script_error_event") {
                  const response = await window.fetch("/__get_error_cause__/".concat(encodeURIComponent(exception.site.isInline ? exception.site.originalUrl : exception.site.url)));
                  if (response.status !== 200) {
                    return;
                  }
                  const causeInfo = await response.json();
                  if (!causeInfo) {
                    return;
                  }
                  exception.cause = causeInfo;
                  renderException();
                  return;
                }
                if (exception.site.line !== undefined) {
                  const urlToFetch = new URL("/__get_cause_trace__/".concat(encodeURIComponent(stringifyUrlSite(exception.site))), window.origin);
                  if (!exception.stackSourcemapped) {
                    urlToFetch.searchParams.set("remap", "");
                  }
                  const response = await window.fetch(urlToFetch);
                  if (response.status !== 200) {
                    return;
                  }
                  const causeTrace = await response.json();
                  exception.cause = {
                    trace: causeTrace
                  };
                  renderException();
                  return;
                }
              } catch (e) {
                // happens if server is closed for instance
                return;
              }
            })();
          }
        }
      }
      const generateClickableText = text => {
        const textWithHtmlLinks = makeLinksClickable(text, {
          createLink: ({
            url,
            line,
            column
          }) => {
            const urlSite = resolveUrlSite({
              url,
              line,
              column
            });
            if (errorBaseUrl) {
              if (urlSite.url.startsWith(rootDirectoryUrl)) {
                urlSite.url = "".concat(errorBaseUrl).concat(urlSite.url.slice(rootDirectoryUrl.length));
              } else {
                urlSite.url = "file:///mocked_for_snapshots";
              }
            }
            const urlWithLineAndColumn = stringifyUrlSite(urlSite);
            return {
              href: urlSite.url.startsWith("file:") && openInEditor ? "javascript:window.fetch('/__open_in_editor__/".concat(encodeURIComponent(urlWithLineAndColumn), "')") : urlSite.url,
              text: urlWithLineAndColumn
            };
          }
        });
        return textWithHtmlLinks;
      };
      const makeLinksClickable = (string, {
        createLink = ({
          url
        }) => url
      }) => {
        // normalize line breaks
        string = string.replace(/\r\n/g, "\n");
        string = escapeHtml(string);
        // render links
        string = replaceUrls(string, ({
          url,
          line,
          column
        }) => {
          const {
            href,
            text
          } = createLink({
            url,
            line,
            column
          });
          return link({
            href,
            text
          });
        });
        return string;
      };
      const prefixRemainingLines = (text, prefix) => {
        const lines = text.split(/\r?\n/);
        const firstLine = lines.shift();
        let result = firstLine;
        let i = 0;
        while (i < lines.length) {
          const line = lines[i];
          i++;
          result += line.length ? "\n".concat(prefix).concat(line) : "\n";
        }
        return result;
      };
      const escapeHtml = string => {
        return string.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };
      const link = ({
        href,
        text = href
      }) => "<a href=\"".concat(href, "\">").concat(text, "</a>");
      if (customElements && !customElements.get(JSENV_ERROR_OVERLAY_TAGNAME)) {
        customElements.define(JSENV_ERROR_OVERLAY_TAGNAME, JsenvErrorOverlay);
      }
      const overlayCSS = "\n  :host {\n    position: fixed;\n    z-index: 99999;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    overflow-y: scroll;\n    margin: 0;\n    background: rgba(0, 0, 0, 0.66);\n  }\n  \n  .backdrop {\n    position: absolute;\n    left: 0;\n    right: 0;\n    top: 0;\n    bottom: 0;\n  }\n  \n  .overlay {\n    position: relative;\n    background: rgba(0, 0, 0, 0.95);\n    width: 800px;\n    margin: 30px auto;\n    padding: 25px 40px;\n    padding-top: 0;\n    overflow: hidden; /* for h1 margins */\n    border-radius: 4px 8px;\n    box-shadow: 0 20px 40px rgb(0 0 0 / 30%), 0 15px 12px rgb(0 0 0 / 20%);\n    box-sizing: border-box;\n    font-family: monospace;\n    direction: ltr;\n  }\n  \n  h1 {\n    color: red;\n    text-align: center;\n  }\n  \n  pre {\n    overflow: auto;\n    max-width: 100%;\n    /* padding is nice + prevents scrollbar from hiding the text behind it */\n    /* does not work nicely on firefox though https://bugzilla.mozilla.org/show_bug.cgi?id=748518 */\n    padding: 20px; \n  }\n  \n  .tip {\n    border-top: 1px solid #999;\n    padding-top: 12px;\n  }\n  \n  [data-theme=\"dark\"] {\n    color: #999;\n  }\n  [data-theme=\"dark\"] pre {\n    background: #111;\n    border: 1px solid #333;\n    color: #eee;\n  }\n  \n  [data-theme=\"light\"] {\n    color: #EEEEEE;\n  }\n  [data-theme=\"light\"] pre {\n    background: #1E1E1E;\n    border: 1px solid white;\n    color: #EEEEEE;\n  }\n  \n  pre a {\n    color: inherit;\n  }";
    }
    supervisor.createException = createException;
    supervisor.reportException = exception => {
      if (errorOverlay) {
        const removeErrorOverlay = displayJsenvErrorOverlay(exception);
        if (window.__reloader__) {
          const onchange = window.__reloader__.status.onchange;
          window.__reloader__.status.onchange = () => {
            onchange();
            if (window.__reloader__.status.value === "reloading") {
              removeErrorOverlay();
            }
          };
        }
      }
      if (errorNotification) {
        displayErrorNotification({
          title: "An error occured",
          text: "todo"
        });
      }
      return exception;
    };
    window.addEventListener("error", errorEvent => {
      if (!errorEvent.isTrusted) {
        // ignore custom error event (not sent by browser)
        if (logs) {
          console.log("ignore non trusted error event", errorEvent);
        }
        return;
      }
      if (logs) {
        console.log('window "error" event received', errorEvent);
      }
      const {
        error,
        message,
        filename,
        lineno,
        colno
      } = errorEvent;
      const exception = supervisor.createException(error || message, {
        // when error is reported within a worker error is null
        // but there is a message property on errorEvent
        reportedBy: "window_error_event",
        message,
        url: filename,
        line: lineno,
        column: colno
      });
      supervisor.reportException(exception);
    });
    window.addEventListener("unhandledrejection", event => {
      if (event.defaultPrevented) {
        return;
      }
      const exception = supervisor.createException(event.reason, {
        reportedBy: "window_unhandledrejection_event"
      });
      supervisor.reportException(exception);
    });
  };
  const prepareScriptToLoad = script => {
    // do not use script.cloneNode()
    // bcause https://stackoverflow.com/questions/28771542/why-dont-clonenode-script-tags-execute
    const scriptClone = document.createElement("script");
    // browsers set async by default when creating script(s)
    // we want an exact copy to preserves how code is executed
    scriptClone.async = false;
    Array.from(script.attributes).forEach(attribute => {
      scriptClone.setAttribute(attribute.nodeName, attribute.nodeValue);
    });
    scriptClone.removeAttribute("jsenv-cooked-by");
    scriptClone.removeAttribute("jsenv-inlined-by");
    scriptClone.removeAttribute("jsenv-injected-by");
    scriptClone.removeAttribute("inlined-from-src");
    scriptClone.removeAttribute("original-position");
    scriptClone.removeAttribute("original-src-position");
    return scriptClone;
  };
  const getScriptLoadPromise = async script => {
    return new Promise(resolve => {
      const windowErrorEventCallback = errorEvent => {
        if (errorEvent.filename === script.src) {
          removeWindowErrorEventCallback();
          resolve({
            detectedBy: "window_error_event",
            failed: true,
            errorEvent
          });
        }
      };
      const removeWindowErrorEventCallback = () => {
        window.removeEventListener("error", windowErrorEventCallback);
      };
      window.addEventListener("error", windowErrorEventCallback);
      script.addEventListener("error", errorEvent => {
        removeWindowErrorEventCallback();
        resolve({
          detectedBy: "script_error_event",
          failed: true,
          errorEvent
        });
      });
      script.addEventListener("load", () => {
        removeWindowErrorEventCallback();
        resolve({
          detectedBy: "script_load_event"
        });
      });
    });
  };
  return supervisor;
})();
