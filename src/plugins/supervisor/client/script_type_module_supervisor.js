let previousExecutionPromise

export const superviseScriptTypeModule = async ({ src, async }) => {
  const currentScript = document.querySelector(
    `script[type="module"][inlined-from-src="${src}"]`,
  )
  const parentNode = currentScript.parentNode
  let nodeToReplace
  let currentScriptClone

  const startExecution = () => {
    const execution = window.__supervisor__.createExecution({
      src,
      type: "js_module",
      execute: ({ isReload }) => {
        return new Promise((resolve, reject) => {
          currentScriptClone = document.createElement("script")
          Array.from(currentScript.attributes).forEach((attribute) => {
            currentScriptClone.setAttribute(
              attribute.nodeName,
              attribute.nodeValue,
            )
          })
          const urlObject = new URL(src, window.location)
          if (isReload) {
            urlObject.searchParams.set("hmr", Date.now())
            nodeToReplace = currentScriptClone
            currentScriptClone.src = urlObject.href
          } else {
            currentScriptClone.removeAttribute("jsenv-plugin-owner")
            currentScriptClone.removeAttribute("jsenv-plugin-action")
            currentScriptClone.removeAttribute("inlined-from-src")
            currentScriptClone.removeAttribute("original-position")
            currentScriptClone.removeAttribute("original-src-position")
            nodeToReplace = currentScript
            currentScriptClone.src = src
          }
          currentScriptClone.addEventListener("error", () => {
            reject({
              reason: {
                message: `Failed to fetch module: ${urlObject.href}`,
                url: urlObject.href,
              },
              reportedBy: "script_error_event",
            })
          })
          let importPromise
          currentScriptClone.addEventListener("load", async () => {
            // do not resolve right away, wait for top level execution
            try {
              if (!importPromise) {
                importPromise = import(urlObject.href)
              }
              const namespace = await importPromise
              resolve(namespace)
            } catch (e) {
              reject({
                reason: e,
                reportedBy: "dynamic_import",
              })
            }
          })
          // https://twitter.com/damienmaillard/status/1554752482273787906
          const isWebkitOrSafari =
            typeof window.webkitConvertPointFromNodeToPage === "function"
          if (isWebkitOrSafari) {
            importPromise = import(urlObject.href)
          }
          parentNode.replaceChild(currentScriptClone, nodeToReplace)
        })
      },
    })
    return execution.start()
  }

  if (async) {
    startExecution({ currentScript, src })
    return
  }
  // there is guaranteed execution order for non async script type="module"
  // see https://gist.github.com/jakub-g/385ee6b41085303a53ad92c7c8afd7a6#typemodule-vs-non-module-typetextjavascript-vs-script-nomodule
  if (previousExecutionPromise) {
    await previousExecutionPromise
    previousExecutionPromise = null
  }
  previousExecutionPromise = startExecution({ currentScript, src })
}
