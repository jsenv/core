import { u as uneval } from "./uneval.js";

const unevalException = value => {
  if (value && value.hasOwnProperty("toString")) {
    delete value.toString;
  }

  return uneval(value, {
    ignoreSymbols: true
  });
};

const formatError = (error, {
  rootDirectoryUrl,
  errorBaseUrl,
  openInEditor,
  url,
  line,
  column,
  codeFrame,
  requestedRessource,
  reportedBy
}) => {
  let {
    message,
    stack
  } = normalizeErrorParts(error);
  let codeFramePromiseReference = {
    current: null
  };
  let tip = formatTip({
    reportedBy,
    requestedRessource
  });
  let errorUrlSite;

  const resolveUrlSite = ({
    url,
    line,
    column
  }) => {
    const inlineUrlMatch = url.match(/@L([0-9]+)\-L([0-9]+)\.[\w]+$/);

    if (inlineUrlMatch) {
      const htmlUrl = url.slice(0, inlineUrlMatch.index);
      const tagLine = parseInt(inlineUrlMatch[1]);
      const tagColumn = parseInt(inlineUrlMatch[2]);
      url = htmlUrl;
      line = tagLine + parseInt(line) - 1;
      column = tagColumn + parseInt(column);
    }

    let urlObject = new URL(url);

    if (urlObject.origin === window.origin) {
      urlObject = new URL(`${urlObject.pathname.slice(1)}${urlObject.search}`, rootDirectoryUrl);
    }

    if (urlObject.href.startsWith("file:")) {
      const atFsIndex = urlObject.pathname.indexOf("/@fs/");

      if (atFsIndex > -1) {
        const afterAtFs = urlObject.pathname.slice(atFsIndex + "/@fs/".length);
        url = new URL(afterAtFs, "file:///").href;
      } else {
        url = urlObject.href;
      }
    } else {
      url = urlObject.href;
    }

    return {
      url,
      line,
      column
    };
  };

  const generateClickableText = text => {
    const textWithHtmlLinks = makeLinksClickable(text, {
      createLink: (url, {
        line,
        column
      }) => {
        const urlSite = resolveUrlSite({
          url,
          line,
          column
        });

        if (!errorUrlSite && text === stack) {
          onErrorLocated(urlSite);
        }

        if (errorBaseUrl) {
          if (urlSite.url.startsWith(rootDirectoryUrl)) {
            urlSite.url = `${errorBaseUrl}${urlSite.url.slice(rootDirectoryUrl.length)}`;
          } else {
            urlSite.url = "file:///mocked_for_snapshots";
          }
        }

        const urlWithLineAndColumn = formatUrlWithLineAndColumn(urlSite);
        return {
          href: url.startsWith("file:") && openInEditor ? `javascript:window.fetch('/__open_in_editor__/${urlWithLineAndColumn}')` : urlSite.url,
          text: urlWithLineAndColumn
        };
      }
    });
    return textWithHtmlLinks;
  };

  const onErrorLocated = urlSite => {
    errorUrlSite = urlSite;

    if (codeFrame) {
      return;
    }

    if (reportedBy !== "browser") {
      return;
    }

    codeFramePromiseReference.current = (async () => {
      const response = await window.fetch(`/__get_code_frame__/${formatUrlWithLineAndColumn(urlSite)}`);
      const codeFrame = await response.text();
      const codeFrameClickable = generateClickableText(codeFrame);
      return codeFrameClickable;
    })();
  }; // error.stack is more reliable than url/line/column reported on window error events
  // so use it only when error.stack is not available


  if (url && !stack) {
    onErrorLocated(resolveUrlSite({
      url,
      line,
      column
    }));
  }

  let text;

  if (message && stack) {
    text = `${generateClickableText(message)}\n${generateClickableText(stack)}`;
  } else if (stack) {
    text = generateClickableText(stack);
  } else {
    text = generateClickableText(message);
  }

  if (codeFrame) {
    text += `\n\n${generateClickableText(codeFrame)}`;
  }

  return {
    theme: error && error.cause && error.cause.code === "PARSE_ERROR" ? "light" : "dark",
    title: "An error occured",
    text,
    codeFramePromise: codeFramePromiseReference.current,
    tip: `${tip}
    <br />
    Click outside to close.`
  };
};

const formatUrlWithLineAndColumn = ({
  url,
  line,
  column
}) => {
  return line === undefined && column === undefined ? url : column === undefined ? `${url}:${line}` : `${url}:${line}:${column}`;
};

const normalizeErrorParts = error => {
  if (error === undefined) {
    return {
      message: "undefined"
    };
  }

  if (error === null) {
    return {
      message: "null"
    };
  }

  if (typeof error === "string") {
    return {
      message: error
    };
  }

  if (error instanceof Error) {
    if (error.name === "SyntaxError") {
      return {
        message: error.message
      };
    }

    if (error.cause && error.cause.code === "PARSE_ERROR") {
      if (error.messageHTML) {
        return {
          message: error.messageHTML
        };
      }

      return {
        message: error.message
      };
    } // stackTrace formatted by V8


    if (Error.captureStackTrace) {
      return {
        message: error.message,
        stack: getErrorStackWithoutErrorMessage(error)
      };
    }

    return {
      message: error.message,
      stack: error.stack ? `  ${error.stack}` : null
    };
  }

  if (typeof error === "object") {
    return error;
  }

  return {
    message: JSON.stringify(error)
  };
};

const getErrorStackWithoutErrorMessage = error => {
  let stack = error.stack;
  const messageInStack = `${error.name}: ${error.message}`;

  if (stack.startsWith(messageInStack)) {
    stack = stack.slice(messageInStack.length);
  }

  const nextLineIndex = stack.indexOf("\n");

  if (nextLineIndex > -1) {
    stack = stack.slice(nextLineIndex + 1);
  }

  return stack;
};

const formatTip = ({
  reportedBy,
  requestedRessource
}) => {
  if (reportedBy === "browser") {
    return `Reported by the browser while executing <code>${window.location.pathname}${window.location.search}</code>.`;
  }

  return `Reported by the server while serving <code>${requestedRessource}</code>`;
};

const makeLinksClickable = (string, {
  createLink = url => url
}) => {
  // normalize line breaks
  string = string.replace(/\n/g, "\n");
  string = escapeHtml(string); // render links

  string = stringToStringWithLink(string, {
    transform: (url, {
      line,
      column
    }) => {
      const {
        href,
        text
      } = createLink(url, {
        line,
        column
      });
      return link({
        href,
        text
      });
    }
  });
  return string;
};

const escapeHtml = string => {
  return string.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}; // `Error: yo
// at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
// at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
// at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
// at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
//   debugger
// })


const stringToStringWithLink = (source, {
  transform = url => {
    return {
      href: url,
      text: url
    };
  }
} = {}) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, match => {
    let linkHTML = "";
    const lastChar = match[match.length - 1]; // hotfix because our url regex sucks a bit

    const endsWithSeparationChar = lastChar === ")" || lastChar === ":";

    if (endsWithSeparationChar) {
      match = match.slice(0, -1);
    }

    const lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
    const lineAndColumMatch = match.match(lineAndColumnPattern);

    if (lineAndColumMatch) {
      const lineAndColumnString = lineAndColumMatch[0];
      const lineNumber = lineAndColumMatch[1];
      const columnNumber = lineAndColumMatch[2];
      linkHTML = transform(match.slice(0, -lineAndColumnString.length), {
        line: lineNumber,
        column: columnNumber
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);

      if (lineMatch) {
        const lineString = lineMatch[0];
        const lineNumber = lineMatch[1];
        linkHTML = transform(match.slice(0, -lineString.length), {
          line: lineNumber
        });
      } else {
        linkHTML = transform(match, {});
      }
    }

    if (endsWithSeparationChar) {
      return `${linkHTML}${lastChar}`;
    }

    return linkHTML;
  });
};

const link = ({
  href,
  text = href
}) => `<a href="${href}">${text}</a>`;

const JSENV_ERROR_OVERLAY_TAGNAME = "jsenv-error-overlay";
const displayErrorInDocument = (error, {
  rootDirectoryUrl,
  errorBaseUrl,
  openInEditor,
  url,
  line,
  column,
  codeFrame,
  reportedBy,
  requestedRessource
}) => {
  const {
    theme,
    title,
    text,
    codeFramePromise,
    tip
  } = formatError(error, {
    rootDirectoryUrl,
    errorBaseUrl,
    openInEditor,
    url,
    line,
    column,
    codeFrame,
    reportedBy,
    requestedRessource
  });
  let jsenvErrorOverlay = new JsenvErrorOverlay({
    theme,
    title,
    text,
    codeFramePromise,
    tip
  });
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

  if (window.__reloader__) {
    window.__reloader__.onstatuschange = () => {
      if (window.__reloader__.status === "reloading") {
        removeErrorOverlay();
      }
    };
  }

  return removeErrorOverlay;
};

class JsenvErrorOverlay extends HTMLElement {
  constructor({
    theme,
    title,
    text,
    codeFramePromise,
    tip
  }) {
    super();
    this.root = this.attachShadow({
      mode: "open"
    });
    this.root.innerHTML = `
<style>
  ${overlayCSS}
</style>
<div class="backdrop"></div>
<div class="overlay" data-theme=${theme}>
  <h1 class="title">
    ${title}
  </h1>
  <pre class="text">${text}</pre>
  <div class="tip">
    ${tip}
  </div>
</div>`;

    this.root.querySelector(".backdrop").onclick = () => {
      if (!this.parentNode) {
        // not in document anymore
        return;
      }

      this.root.querySelector(".backdrop").onclick = null;
      this.parentNode.removeChild(this);
    };

    if (codeFramePromise) {
      codeFramePromise.then(codeFrame => {
        if (this.parentNode) {
          this.root.querySelector(".text").innerHTML += `\n\n${codeFrame}`;
        }
      });
    }
  }

}

if (customElements && !customElements.get(JSENV_ERROR_OVERLAY_TAGNAME)) {
  customElements.define(JSENV_ERROR_OVERLAY_TAGNAME, JsenvErrorOverlay);
}

const overlayCSS = `
:host {
  position: fixed;
  z-index: 99999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  margin: 0;
  background: rgba(0, 0, 0, 0.66);
}

.backdrop {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
}

.overlay {
  position: relative;
  background: rgba(0, 0, 0, 0.95);
  width: 800px;
  margin: 30px auto;
  padding: 25px 40px;
  padding-top: 0;
  overflow: hidden; /* for h1 margins */
  border-radius: 4px 8px;
  box-shadow: 0 20px 40px rgb(0 0 0 / 30%), 0 15px 12px rgb(0 0 0 / 20%);
  box-sizing: border-box;
  font-family: monospace;
  direction: ltr;
}

h1 {
  color: red;
  text-align: center;
}

pre {
  overflow: auto;
  max-width: 100%;
  /* padding is nice + prevents scrollbar from hiding the text behind it */
  /* does not work nicely on firefox though https://bugzilla.mozilla.org/show_bug.cgi?id=748518 */
  padding: 20px; 
}

.tip {
  border-top: 1px solid #999;
  padding-top: 12px;
}

[data-theme="dark"] {
  color: #999;
}
[data-theme="dark"] pre {
  background: #111;
  border: 1px solid #333;
  color: #eee;
}

[data-theme="light"] {
  color: #EEEEEE;
}
[data-theme="light"] pre {
  background: #1E1E1E;
  border: 1px solid white;
  color: #EEEEEE;
}

pre a {
  color: inherit;
}`;

const {
  Notification
} = window;

const displayErrorNotificationNotAvailable = () => {};

const displayErrorNotificationImplementation = (error, {
  icon
} = {}) => {
  if (Notification.permission === "granted") {
    const notification = new Notification("An error occured", {
      lang: "en",
      body: error ? error.stack : "undefined",
      icon
    });

    notification.onclick = () => {
      window.focus();
    };
  }
};

const displayErrorNotification = typeof Notification === "function" ? displayErrorNotificationImplementation : displayErrorNotificationNotAvailable;

const {
  __html_supervisor__
} = window;
const supervisedScripts = [];
const installHtmlSupervisor = ({
  rootDirectoryUrl,
  logs,
  measurePerf,
  errorOverlay,
  errorBaseUrl,
  openInEditor
}) => {

  const scriptExecutionResults = {};
  let collectCalled = false;
  let pendingExecutionCount = 0;
  let resolveScriptExecutionsPromise;
  const scriptExecutionsPromise = new Promise(resolve => {
    resolveScriptExecutionsPromise = resolve;
  });

  const onExecutionStart = name => {
    scriptExecutionResults[name] = null; // ensure execution order is reflected into the object

    pendingExecutionCount++;

    if (measurePerf) {
      performance.mark(`execution_start`);
    }
  };

  const onExecutionSettled = (name, executionResult) => {
    if (measurePerf) {
      performance.measure(`execution`, `execution_start`);
    }

    scriptExecutionResults[name] = executionResult;
    pendingExecutionCount--;

    if (pendingExecutionCount === 0 && collectCalled) {
      resolveScriptExecutionsPromise();
    }
  };

  const onExecutionError = (executionResult, {
    currentScript,
    errorExposureInNotification = false
  }) => {
    const error = executionResult.error;

    if (error && error.code === "NETWORK_FAILURE") {
      if (currentScript) {
        const currentScriptErrorEvent = new Event("error");
        currentScript.dispatchEvent(currentScriptErrorEvent);
      }
    } else if (typeof error === "object") {
      const globalErrorEvent = new Event("error");
      globalErrorEvent.filename = error.filename;
      globalErrorEvent.lineno = error.line || error.lineno;
      globalErrorEvent.colno = error.column || error.columnno;
      globalErrorEvent.message = error.message;
      window.dispatchEvent(globalErrorEvent);
    }

    if (errorExposureInNotification) {
      displayErrorNotification(error);
    }

    executionResult.exceptionSource = unevalException(error);
    delete executionResult.error;
  };

  const getNavigationStartTime = () => {
    try {
      return window.performance.timing.navigationStart;
    } catch (e) {
      return Date.now();
    }
  };

  const performExecution = async ({
    src,
    type,
    currentScript,
    execute // https://developer.mozilla.org/en-US/docs/web/html/element/script

  }, {
    reload = false
  } = {}) => {
    if (logs) {
      console.group(`[jsenv] loading ${type} ${src}`);
    }

    onExecutionStart(src);
    let completed;
    let result;
    let error;

    try {
      const urlObject = new URL(src, window.location);

      if (reload) {
        urlObject.searchParams.set("hmr", Date.now());
      }

      result = await execute(urlObject.href);
      completed = true;
    } catch (e) {
      completed = false;
      error = e;
    }

    if (completed) {
      const executionResult = {
        status: "completed",
        namespace: result,
        coverage: window.__coverage__
      };
      onExecutionSettled(src, executionResult);

      if (logs) {
        console.log(`${type} load ended`);
        console.groupEnd();
      }

      return;
    }

    const executionResult = {
      status: "errored",
      coverage: window.__coverage__
    };

    if (error.name === "SyntaxError") ;

    executionResult.error = error;
    onExecutionSettled(src, executionResult);
    onExecutionError(executionResult, {
      currentScript
    });

    {
      if (typeof window.reportError === "function") {
        window.reportError(error);
      } else {
        console.error(error);
      }
    }

    if (logs) {
      console.groupEnd();
    }
  };

  const classicExecutionQueue = createExecutionQueue(performExecution);
  const deferedExecutionQueue = createExecutionQueue(performExecution);
  deferedExecutionQueue.waitFor(new Promise(resolve => {
    if (document.readyState === "interactive" || document.readyState === "complete") {
      resolve();
    } else {
      document.addEventListener("readystatechange", () => {
        if (document.readyState === "interactive") {
          resolve();
        }
      });
    }
  }));

  __html_supervisor__.addScriptToExecute = async scriptToExecute => {
    if (!supervisedScripts.includes(scriptToExecute)) {
      supervisedScripts.push(scriptToExecute);

      scriptToExecute.reload = () => {
        return performExecution(scriptToExecute, {
          reload: true
        });
      };
    }

    if (scriptToExecute.async) {
      performExecution(scriptToExecute);
      return;
    }

    const useDeferQueue = scriptToExecute.defer || scriptToExecute.type === "module";

    if (useDeferQueue) {
      // defer must wait for classic script to be done
      const classicExecutionPromise = classicExecutionQueue.getPromise();

      if (classicExecutionPromise) {
        deferedExecutionQueue.waitFor(classicExecutionPromise);
      }

      deferedExecutionQueue.executeAsap(scriptToExecute);
    } else {
      classicExecutionQueue.executeAsap(scriptToExecute);
    }
  };

  __html_supervisor__.collectScriptResults = async () => {
    collectCalled = true;

    if (pendingExecutionCount === 0) {
      resolveScriptExecutionsPromise();
    } else {
      await scriptExecutionsPromise;
    }

    let status = "completed";
    let exceptionSource = "";
    Object.keys(scriptExecutionResults).forEach(key => {
      const scriptExecutionResult = scriptExecutionResults[key];

      if (scriptExecutionResult.status === "errored") {
        status = "errored";
        exceptionSource = scriptExecutionResult.exceptionSource;
      }
    });
    return {
      status,
      ...(status === "errored" ? {
        exceptionSource
      } : {}),
      startTime: getNavigationStartTime(),
      endTime: Date.now(),
      scriptExecutionResults
    };
  };

  const {
    scriptsToExecute
  } = __html_supervisor__;
  const copy = scriptsToExecute.slice();
  scriptsToExecute.length = 0;
  copy.forEach(scriptToExecute => {
    __html_supervisor__.addScriptToExecute(scriptToExecute);
  });

  if (errorOverlay) {
    window.addEventListener("error", errorEvent => {
      if (!errorEvent.isTrusted) {
        // ignore custom error event (not sent by browser)
        return;
      }

      const {
        error
      } = errorEvent;
      displayErrorInDocument(error, {
        rootDirectoryUrl,
        errorBaseUrl,
        openInEditor,
        url: errorEvent.filename,
        line: errorEvent.lineno,
        column: errorEvent.colno,
        reportedBy: "browser"
      });
    });

    if (window.__server_events__) {
      const isExecuting = () => {
        if (pendingExecutionCount > 0) {
          return true;
        }

        if (document.readyState === "loading" || document.readyState === "interactive") {
          return true;
        }

        if (window.__reloader__ && window.__reloader__.status === "reloading") {
          return true;
        }

        return false;
      };

      window.__server_events__.addEventCallbacks({
        error_while_serving_file: serverErrorEvent => {
          if (!isExecuting()) {
            return;
          }

          const {
            message,
            stack,
            traceUrl,
            traceLine,
            traceColumn,
            traceMessage,
            requestedRessource,
            isFaviconAutoRequest
          } = JSON.parse(serverErrorEvent.data);

          if (isFaviconAutoRequest) {
            return;
          } // setTimeout is to ensure the error
          // dispatched on window by browser is displayed first,
          // then the server error replaces it (because it contains more information)


          setTimeout(() => {
            displayErrorInDocument({
              message,
              stack
            }, {
              rootDirectoryUrl,
              errorBaseUrl,
              openInEditor,
              url: traceUrl,
              line: traceLine,
              column: traceColumn,
              codeFrame: traceMessage,
              reportedBy: "server",
              requestedRessource
            });
          }, 10);
        }
      });
    }
  }
};

__html_supervisor__.reloadSupervisedScript = ({
  type,
  src
}) => {
  const supervisedScript = supervisedScripts.find(supervisedScriptCandidate => {
    if (type && supervisedScriptCandidate.type !== type) {
      return false;
    }

    if (supervisedScriptCandidate.src !== src) {
      return false;
    }

    return true;
  });

  if (supervisedScript) {
    supervisedScript.reload();
  }
};

const superviseScriptTypeModule = ({
  src,
  isInline
}) => {
  __html_supervisor__.addScriptToExecute({
    src,
    type: "module",
    isInline,
    execute: url => import(url)
  });
};

const createExecutionQueue = execute => {
  const scripts = [];
  let promiseToWait = null;

  const waitFor = async promise => {
    promiseToWait = promise;
    promiseToWait.then(() => {
      promiseToWait = null;
      dequeue();
    }, () => {
      promiseToWait = null;
      dequeue();
    });
  };

  const executeAsap = async script => {
    if (promiseToWait) {
      scripts.push(script);
      return;
    }

    waitFor(execute(script));
  };

  const dequeue = () => {
    const scriptWaiting = scripts.shift();

    if (scriptWaiting) {
      __html_supervisor__.addScriptToExecute(scriptWaiting);
    }
  };

  return {
    waitFor,
    executeAsap,
    getPromise: () => promiseToWait
  };
};

export { installHtmlSupervisor, superviseScriptTypeModule };
