window.__html_supervisor__ = {
  // "html_supervisor_installer.js" will implement
  // - "addScriptToExecute"
  // - "superviseScriptTypeModule"
  // - "collectScriptResults"
  // and take all executions in "scriptsToExecute" and implement their supervision
  scriptsToExecute: [],
  addScriptToExecute: (scriptToExecute) => {
    window.__html_supervisor__.scriptsToExecute.push(scriptToExecute)
  },
  superviseScript: ({ src, isInline, crossorigin, integrity }) => {
    window.__html_supervisor__.addScriptToExecute({
      src,
      type: "js_classic",
      isInline,
      currentScript: document.currentScript,
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
          document.body.appendChild(script)
        })
      },
    })
  },
  superviseScriptTypeModule: () => {
    throw new Error("htmlSupervisor not installed")
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
      return window.__html_supervisor__.collectScriptResults()
    })
  },
  collectScriptResults: () => {
    throw new Error("htmlSupervisor not installed")
  },
}
