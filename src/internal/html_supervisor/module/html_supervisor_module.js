import { initHtmlSupervisor } from "../html_supervisor.js"

const htmlSupervisor = initHtmlSupervisor()
window.__html_supervisor__.setHtmlSupervisor(htmlSupervisor)

export const superviseScriptTypeModule = ({ src }) => {
  htmlSupervisor.addExecution({
    src,
    currentScript: null,
    promise: import(new URL(src, document.location.href).href),
  })
}
