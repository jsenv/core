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
          const url = urlObject.href

          let lastWindowErrorUrl
          let lastWindowError
          const windowErrorCallback = (e) => {
            lastWindowErrorUrl = e.filename
            lastWindowError = e.error
          }
          const cleanup = () => {
            window.removeEventListener("error", windowErrorCallback)
          }
          window.addEventListener("error", windowErrorCallback)
          currentScriptClone.addEventListener("error", () => {
            cleanup()
            reject({
              code: "FETCH_ERROR",
              message: `Failed to fetch module: ${url}`,
              url,
            })
          })
          currentScriptClone.addEventListener("load", () => {
            cleanup()
            if (lastWindowErrorUrl === url) {
              reject(lastWindowError)
            } else {
              // do not resolve right away, wait for top level execution
              // const executionPromise = import(url)
              resolve()
            }
          })
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
