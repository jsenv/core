import { u as uneval } from "./uneval.js";

const unevalException = value => {
  if (value && value.hasOwnProperty("toString")) {
    delete value.toString;
  }

  return uneval(value, {
    ignoreSymbols: true
  });
};

const JSENV_ERROR_OVERLAY_TAGNAME = "jsenv-error-overlay";
const displayErrorInDocument = (error, {
  rootDirectoryUrl,
  url,
  line,
  column
}) => {
  document.querySelectorAll(JSENV_ERROR_OVERLAY_TAGNAME).forEach(node => {
    node.parentNode.removeChild(node);
  });
  const {
    theme,
    title,
    message,
    stack
  } = errorToHTML(error, {
    url,
    line,
    column
  });
  const jsenvErrorOverlay = new JsenvErrorOverlay({
    theme,
    title,
    stack: stack ? `${replaceLinks(message, {
      rootDirectoryUrl
    })}\n${replaceLinks(stack, {
      rootDirectoryUrl
    })}` : replaceLinks(message, {
      rootDirectoryUrl
    })
  });
  document.body.appendChild(jsenvErrorOverlay);
};

class JsenvErrorOverlay extends HTMLElement {
  constructor({
    title,
    stack,
    theme = "dark"
  }) {
    super();
    this.root = this.attachShadow({
      mode: "open"
    });
    this.root.innerHTML = overlayHtml;
    this.root.querySelector(".overlay").setAttribute("data-theme", theme);
    this.root.querySelector(".title").innerHTML = title;
    this.root.querySelector(".stack").innerHTML = stack;

    this.root.querySelector(".backdrop").onclick = () => {
      if (!this.parentNode) {
        // not in document anymore
        return;
      }

      this.root.querySelector(".backdrop").onclick = null;
      this.parentNode.removeChild(this);
    };
  }

}

if (customElements && !customElements.get(JSENV_ERROR_OVERLAY_TAGNAME)) {
  customElements.define(JSENV_ERROR_OVERLAY_TAGNAME, JsenvErrorOverlay);
}

const overlayHtml = `
<style>
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
}
</style>
<div class="backdrop"></div>
<div class="overlay">
  <h1 class="title"></h1>
  <pre class="stack"></pre>
  <div class="tip">Click outside to close.</div>
</div>
`;

const parseErrorInfo = error => {
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

const errorToHTML = (error, {
  url,
  line,
  column
}) => {
  let {
    message,
    stack
  } = parseErrorInfo(error);

  if (url) {
    if (!stack || error && error.name === "SyntaxError") {
      stack = `  at ${appendLineAndColumn(url, {
        line,
        column
      })}`;
    }
  }

  return {
    theme: error && error.cause && error.cause.code === "PARSE_ERROR" ? "light" : "dark",
    title: "An error occured",
    message,
    stack
  };
};

const replaceLinks = (string, {
  rootDirectoryUrl
}) => {
  // normalize line breaks
  string = string.replace(/\n/g, "\n");
  string = escapeHtml(string); // render links

  string = stringToStringWithLink(string, {
    transform: (url, {
      line,
      column
    }) => {
      const urlObject = new URL(url);

      const onFileUrl = fileUrlObject => {
        const atFsIndex = fileUrlObject.pathname.indexOf("/@fs/");
        let fileUrl;

        if (atFsIndex > -1) {
          const afterAtFs = fileUrlObject.pathname.slice(atFsIndex + "/@fs/".length);
          fileUrl = new URL(afterAtFs, "file:///").href;
        } else {
          fileUrl = fileUrlObject.href;
        }

        fileUrl = appendLineAndColumn(fileUrl, {
          line,
          column
        });
        return link({
          href: `javascript:window.fetch('/__open_in_editor__/${fileUrl}')`,
          text: fileUrl
        });
      };

      if (urlObject.origin === window.origin) {
        const fileUrlObject = new URL(`${urlObject.pathname.slice(1)}${urlObject.search}`, rootDirectoryUrl);
        return onFileUrl(fileUrlObject);
      }

      if (urlObject.href.startsWith(rootDirectoryUrl)) {
        return onFileUrl(urlObject);
      }

      return link({
        href: url,
        text: appendLineAndColumn(url, {
          line,
          column
        })
      });
    }
  });
  return string;
};

const escapeHtml = string => {
  return string.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const appendLineAndColumn = (url, {
  line,
  column
}) => {
  if (line !== undefined && column !== undefined) {
    return `${url}:${line}:${column}`;
  }

  if (line !== undefined) {
    return `${url}:${line}`;
  }

  return url;
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
const installHtmlSupervisor = ({
  logs,
  measurePerf,
  rootDirectoryUrl
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
    errorExposureInNotification = false,
    errorExposureInDocument = false
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

    if (errorExposureInDocument) {
      displayErrorInDocument(error, {
        rootDirectoryUrl
      });
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

  }) => {
    if (logs) {
      console.group(`[jsenv] loading ${type} ${src}`);
    }

    onExecutionStart(src);
    let completed;
    let result;
    let error;

    try {
      result = await execute();
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
    if (scriptToExecute.async) {
      performExecution(scriptToExecute);
      return;
    }

    const useDeferQueue = scriptToExecute.defer || scriptToExecute.type === "js_module";

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
      url: errorEvent.filename,
      line: errorEvent.lineno,
      column: errorEvent.colno
    });
  });

  if (window.__jsenv_event_source_client__) {
    const onServerErrorEvent = serverErrorEvent => {
      const data = JSON.parse(serverErrorEvent.data);
      displayErrorInDocument({
        message: data.reason,
        stack: data.contentFrame
      }, {
        rootDirectoryUrl,
        url: data.url,
        line: data.line,
        column: data.column
      });
    };

    window.__jsenv_event_source_client__.addEventCallbacks({
      file_not_found: onServerErrorEvent,
      parse_error: onServerErrorEvent
    });
  }
};
const superviseScriptTypeModule = ({
  src,
  isInline
}) => {
  __html_supervisor__.addScriptToExecute({
    src,
    type: "js_module",
    isInline,
    execute: () => import(new URL(src, document.location.href).href)
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
