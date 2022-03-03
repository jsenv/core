import { initHtmlSupervisor } from "./init_html_supervisor.js"

const htmlSupervisor = initHtmlSupervisor()
window.__html_supervisor__.setHtmlSupervisor(htmlSupervisor)

export const superviseScriptTypeModule = ({ src }) => {
  htmlSupervisor.addExecution({
    type: "js_module",
    currentScript: null,
    improveErrorWithFetch: true,
    src,
    promise: import(new URL(src, document.location.href).href),
  })
}
