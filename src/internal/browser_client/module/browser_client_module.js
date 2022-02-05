import { initHtmlExecution } from "../html_execution.js"

const htmlExecution = initHtmlExecution()

export const superviseDynamicImport = (specifier) => {
  htmlExecution.addExecution({
    name: specifier,
    promise: import(new URL(specifier, document.location.href).href),
    currentScript: document.currentScript,
  })
}

export { htmlExecution }
