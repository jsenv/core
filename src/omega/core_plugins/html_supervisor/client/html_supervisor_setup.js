window.__html_supervisor__ = {
  // "html_supervisor_installer.js" will implement
  // - "addExecution"
  // - "collectScriptResults"
  // - "superviseScriptTypeModule"
  // and take all executions in "executions" and implement their supervision
  executions: [],
  addExecution: (execution) => {
    window.__html_supervisor__.executions.push(execution)
  },
  collectScriptResults: () => {
    throw new Error("htmlSupervisor not installed")
  },
  superviseScriptTypeModule: () => {
    throw new Error("htmlSupervisor not installed")
  },

  superviseScript: ({ src, crossorigin, integrity }) => {
    window.__html_supervisor__.addExecution({
      type: "js_classic",
      improveErrorWithFetch: true,
      currentScript: document.currentScript,
      src,
      promise: new Promise((resolve, reject) => {
        const script = document.createElement("script")
        if (crossorigin) {
          script.crossorigin = crossorigin
        }
        if (integrity) {
          script.integrity = integrity
        }
        script.src = src
        const scriptUrl = new URL(src, window.location).href
        let lastWindowErrorUrl
        let lastWindowError
        const windowErrorCallback = (e) => {
          lastWindowErrorUrl = e.filename
          lastWindowError = e.error
        }
        const cleanup = () => {
          document.body.removeChild(script)
          window.removeEventListener("error", windowErrorCallback)
        }
        window.addEventListener("error", windowErrorCallback)
        script.addEventListener("error", () => {
          cleanup()
          reject(src)
        })
        script.addEventListener("load", () => {
          cleanup()
          if (lastWindowErrorUrl === scriptUrl) {
            reject(lastWindowError)
          } else {
            resolve()
          }
        })
        document.body.appendChild(script)
      }),
    })
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
}
