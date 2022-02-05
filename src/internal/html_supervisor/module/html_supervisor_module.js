import { initHtmlSupervisor } from "../html_supervisor.js"

const htmlSupervisor = initHtmlSupervisor()

export const superviseDynamicImport = (specifier) => {
  htmlSupervisor.addExecution({
    name: specifier,
    promise: import(new URL(specifier, document.location.href).href),
    currentScript: document.currentScript,
  })
}

window.__html_supervisor__.htmlSupervisor = htmlSupervisor
