window.__html_supervisor__ = {
  htmlSupervisor: {
    collectScriptResults: () => {
      throw new Error("htmlSupervisor not set")
    },
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
