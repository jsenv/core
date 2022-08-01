export const superviseScriptTypeModule = ({ src }) => {
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
  execution.start()
}
