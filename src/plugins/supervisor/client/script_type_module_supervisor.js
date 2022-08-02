let previousExecutionPromise

export const superviseScriptTypeModule = async ({ src, async }) => {
  if (async) {
    startExecution({ src })
    return
  }
  // there is guaranteed execution order for non async script type="module"
  // see https://gist.github.com/jakub-g/385ee6b41085303a53ad92c7c8afd7a6#typemodule-vs-non-module-typetextjavascript-vs-script-nomodule
  if (previousExecutionPromise) {
    await previousExecutionPromise
    previousExecutionPromise = null
  }
  previousExecutionPromise = startExecution({ src })
}

const startExecution = ({ src }) => {
  const execution = window.__supervisor__.createExecution({
    src,
    type: "js_module",
    execute: ({ isReload }) => {
      const urlObject = new URL(src, window.location)
      if (isReload) {
        urlObject.searchParams.set("hmr", Date.now())
      }
      const url = urlObject.href
      return import(url)
    },
  })
  return execution.start()
}
