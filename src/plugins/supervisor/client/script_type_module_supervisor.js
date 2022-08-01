export const superviseScriptTypeModule = ({ src }) => {
  const execution = window.__supervisor__.createExecution({
    src,
    type: "js_module",
    execute: (url) => import(url),
  })
  execution.start()
}
