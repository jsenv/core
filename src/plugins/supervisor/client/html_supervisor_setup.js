window.__supervisor__ = {
  // "html_supervisor_installer.js" will implement
  // - "addScriptToExecute"
  // - "superviseScriptTypeModule"
  // - "collectScriptResults"
  // and take all executions in "scriptsToExecute" and implement their supervision
  scriptsToExecute: [],
  addScriptToExecute: (scriptToExecute) => {
    window.__supervisor__.scriptsToExecute.push(scriptToExecute)
  },
  superviseScript: ({ src, isInline, crossorigin, integrity }) => {
    const { currentScript } = document
    window.__supervisor__.addScriptToExecute({
      src,
      type: "js_classic",
      isInline,
      currentScript,
      execute: (url) => {
        return new Promise((resolve, reject) => {
          const script = document.createElement("script")
          if (crossorigin) {
            script.crossorigin = crossorigin
          }
          if (integrity) {
            script.integrity = integrity
          }
          script.src = url
          let lastWindowErrorUrl
          let lastWindowError
          const windowErrorCallback = (e) => {
            lastWindowErrorUrl = e.filename
            lastWindowError = e.error
          }
          const cleanup = () => {
            // the execution of the script itself can remove script from the page
            if (script.parentNode) {
              script.parentNode.removeChild(script)
            }
            window.removeEventListener("error", windowErrorCallback)
          }
          window.addEventListener("error", windowErrorCallback)
          script.addEventListener("error", () => {
            cleanup()
            reject(src)
          })
          script.addEventListener("load", () => {
            cleanup()
            if (lastWindowErrorUrl === url) {
              reject(lastWindowError)
            } else {
              resolve()
            }
          })
          if (currentScript) {
            currentScript.parentNode.insertBefore(
              script,
              currentScript.nextSibling,
            )
          } else {
            document.body.appendChild(script)
          }
        })
      },
    })
  },
  superviseScriptTypeModule: () => {
    throw new Error("supervisor not installed")
  },
  getScriptExecutionResults: () => {
    // wait for page to load before collecting script execution results
    const htmlReadyPromise = new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve()
        return
      }
      const loadCallback = () => {
        window.removeEventListener("load", loadCallback)
        resolve()
      }
      window.addEventListener("load", loadCallback)
    })
    return htmlReadyPromise.then(() => {
      return window.__supervisor__.collectScriptResults()
    })
  },
  collectScriptResults: () => {
    throw new Error("supervisor not installed")
  },
}
