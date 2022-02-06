window.__html_supervisor__ = {
  htmlSupervisor: {
    executions: [],
    addExecution: (execution) => {
      window.__html_supervisor__.htmlSupervisor.executions.push(execution)
    },

    collectScriptResults: () => {
      throw new Error("htmlSupervisor not set")
    },
  },

  superviseScript: ({ src, crossorigin, integrity }) => {
    const execution = {
      src,
      currentScript: document.currentScript,
      promise: new Promise((resolve, reject) => {
        // for now we'll use a script tag
        // but we might want to resort on fetch+eval to get better error messages
        const script = document.createElement("script")
        if (crossorigin) {
          script.crossorigin = crossorigin
        }
        if (integrity) {
          script.integrity = integrity
        }
        script.src = src
        script.addEventListener("error", function () {
          document.body.removeChild(script)
          reject(src)
        })
        script.addEventListener("load", function () {
          document.body.removeChild(script)
          resolve()
        })
        document.body.appendChild(script)
      }),
    }
    window.__html_supervisor__.htmlSupervisor.addExecution(execution)
  },

  setHtmlSupervisor: (htmlSupervisor) => {
    const executions = window.__html_supervisor__.htmlSupervisor.executions
    window.__html_supervisor__.htmlSupervisor = htmlSupervisor
    executions.forEach((execution) => {
      htmlSupervisor.addExecution(execution)
    })
    executions.length = 0
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
      return window.__html_supervisor__.htmlSupervisor.collectScriptResults()
    })
  },
}
