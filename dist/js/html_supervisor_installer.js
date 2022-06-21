import { u as uneval } from "./uneval.js";

const unevalException = value => {
  if (value && value.hasOwnProperty("toString")) {
    delete value.toString;
  }

  return uneval(value, {
    ignoreSymbols: true
  });
};

const displayErrorInDocument = error => {
  const title = "An error occured";
  let theme = error && error.cause && error.cause.code === "PARSE_ERROR" ? "light" : "dark";
  let message = errorToHTML(error);
  const css = `
    .jsenv-console {
      background: rgba(0, 0, 0, 0.95);
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 1000;
      box-sizing: border-box;
      padding: 1em;
    }

    .jsenv-console h1 {
      color: red;
      display: flex;
      align-items: center;
    }

    #button-close-jsenv-console {
      margin-left: 10px;
    }

    .jsenv-console pre {
      overflow: auto;
      max-width: 70em;
      /* avoid scrollbar to hide the text behind it */
      padding: 20px;
    }

    .jsenv-console pre[data-theme="dark"] {
      background: #111;
      border: 1px solid #333;
      color: #eee;
    }

    .jsenv-console pre[data-theme="light"] {
      background: #1E1E1E;
      border: 1px solid white;
      color: #EEEEEE;
    }

    .jsenv-console pre a {
      color: inherit;
    }
    `;
  const html = `
      <style type="text/css">${css}></style>
      <div class="jsenv-console">
        <h1>${title} <button id="button-close-jsenv-console">X</button></h1>
        <pre data-theme="${theme}">${message}</pre>
      </div>
      `;
  const removeJsenvConsole = appendHMTLInside(html, document.body);

  document.querySelector("#button-close-jsenv-console").onclick = () => {
    removeJsenvConsole();
  };
};

const escapeHtml = string => {
  return string.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const errorToHTML = error => {
  let html;

  if (error && error instanceof Error) {
    if (error.cause && error.cause.code === "PARSE_ERROR") {
      html = error.messageHTML || escapeHtml(error.message);
    } // stackTrace formatted by V8
    else if (Error.captureStackTrace) {
      html = escapeHtml(error.stack);
    } else {
      // other stack trace such as firefox do not contain error.message
      html = escapeHtml(`${error.message}
  ${error.stack}`);
    }
  } else if (typeof error === "string") {
    html = error;
  } else if (error === undefined) {
    html = "undefined";
  } else {
    html = JSON.stringify(error);
  }

  const htmlWithCorrectLineBreaks = html.replace(/\n/g, "\n");
  const htmlWithLinks = stringToStringWithLink(htmlWithCorrectLineBreaks, {
    transform: url => {
      return {
        href: url,
        text: url
      };
    }
  });
  return htmlWithLinks;
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
      const url = match.slice(0, -lineAndColumnString.length);
      const {
        href,
        text
      } = transform(url);
      linkHTML = link({
        href,
        text: `${text}:${lineNumber}:${columnNumber}`
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);

      if (lineMatch) {
        const lineString = lineMatch[0];
        const lineNumber = lineMatch[1];
        const url = match.slice(0, -lineString.length);
        const {
          href,
          text
        } = transform(url);
        linkHTML = link({
          href,
          text: `${text}:${lineNumber}`
        });
      } else {
        const url = match;
        const {
          href,
          text
        } = transform(url);
        linkHTML = link({
          href,
          text
        });
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

const appendHMTLInside = (html, parentNode) => {
  const temoraryParent = document.createElement("div");
  temoraryParent.innerHTML = html;
  return transferChildren(temoraryParent, parentNode);
};

const transferChildren = (fromNode, toNode) => {
  const childNodes = [].slice.call(fromNode.childNodes, 0);
  let i = 0;

  while (i < childNodes.length) {
    toNode.appendChild(childNodes[i]);
    i++;
  }

  return () => {
    let c = 0;

    while (c < childNodes.length) {
      fromNode.appendChild(childNodes[c]);
      c++;
    }
  };
};

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
  measurePerf
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
    errorExposureInDocument = true
  }) => {
    const error = executionResult.error;

    if (error && error.code === "NETWORK_FAILURE") {
      if (currentScript) {
        const errorEvent = new Event("error");
        currentScript.dispatchEvent(errorEvent);
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
      displayErrorInDocument(error);
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
