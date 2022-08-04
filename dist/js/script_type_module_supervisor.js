let previousExecutionPromise; // https://twitter.com/damienmaillard/status/1554752482273787906

const isWebkitOrSafari = typeof window.webkitConvertPointFromNodeToPage === "function";
const superviseScriptTypeModule = async ({
  src,
  async
}) => {
  const execute = isWebkitOrSafari ? createExecuteWithDynamicImport({
    src
  }) : createExecuteWithScript({
    src
  });

  const startExecution = () => {
    const execution = window.__supervisor__.createExecution({
      src,
      type: "js_module",
      execute
    });

    return execution.start();
  };

  if (async) {
    startExecution();
    return;
  } // there is guaranteed execution order for non async script type="module"
  // see https://gist.github.com/jakub-g/385ee6b41085303a53ad92c7c8afd7a6#typemodule-vs-non-module-typetextjavascript-vs-script-nomodule


  if (previousExecutionPromise) {
    await previousExecutionPromise;
    previousExecutionPromise = null;
  }

  previousExecutionPromise = startExecution();
};

const createExecuteWithScript = ({
  src
}) => {
  const currentScript = document.querySelector(`script[type="module"][inlined-from-src="${src}"]`);
  const parentNode = currentScript.parentNode;
  let nodeToReplace;
  let currentScriptClone;
  return async ({
    isReload
  }) => {
    const urlObject = new URL(src, window.location);
    const loadPromise = new Promise((resolve, reject) => {
      currentScriptClone = document.createElement("script");
      Array.from(currentScript.attributes).forEach(attribute => {
        currentScriptClone.setAttribute(attribute.nodeName, attribute.nodeValue);
      });

      if (isReload) {
        urlObject.searchParams.set("hmr", Date.now());
        nodeToReplace = currentScriptClone;
        currentScriptClone.src = urlObject.href;
      } else {
        currentScriptClone.removeAttribute("jsenv-plugin-owner");
        currentScriptClone.removeAttribute("jsenv-plugin-action");
        currentScriptClone.removeAttribute("inlined-from-src");
        currentScriptClone.removeAttribute("original-position");
        currentScriptClone.removeAttribute("original-src-position");
        nodeToReplace = currentScript;
        currentScriptClone.src = src;
      }

      currentScriptClone.addEventListener("error", reject);
      currentScriptClone.addEventListener("load", resolve);
      parentNode.replaceChild(currentScriptClone, nodeToReplace);
    });

    try {
      await loadPromise;
    } catch (e) {
      // eslint-disable-next-line no-throw-literal
      throw {
        message: `Failed to fetch module: ${urlObject.href}`,
        reportedBy: "script_error_event",
        url: urlObject.href,
        // window.error won't be dispatched for this error
        needsReport: true
      };
    } // do not resolve right away, wait for top level execution


    try {
      const namespace = await import(urlObject.href);
      return namespace;
    } catch (e) {
      e.reportedBy = "dynamic_import";
      throw e;
    }
  };
};

const createExecuteWithDynamicImport = ({
  src
}) => {
  return async ({
    isReload
  }) => {
    const urlObject = new URL(src, window.location);

    if (isReload) {
      urlObject.searchParams.set("hmr", Date.now());
    }

    try {
      const namespace = await import(urlObject.href);
      return namespace;
    } catch (e) {
      e.reportedBy = "dynamic_import"; // dynamic import would hide the error to the browser
      // so it must be re-reported using window.reportError

      if (typeof window.reportError === "function") {
        window.reportError(e);
      } else {
        console.error(e);
      }

      throw e;
    }
  };
};

export { superviseScriptTypeModule };
