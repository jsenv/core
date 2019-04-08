import { genericExecuteCompiledFile } from "../genericExecuteCompiledFile.js"
import { loadBrowserImporter } from "./loadBrowserImporter.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"

export const executeCompiledFile = ({
  compileInto,
  compileServerOrigin,
  filenameRelative,
  collectNamespace,
  collectCoverage,
}) =>
  genericExecuteCompiledFile({
    loadImporter: () => loadBrowserImporter({ compileInto, compileServerOrigin }),
    compileInto,
    compileServerOrigin,
    filenameRelative,
    collectNamespace,
    collectCoverage,
    readCoverage,
    onError: (error) => {
      displayErrorInDocument(error, { compileServerOrigin })
      displayErrorInConsole(error)
    },
    transformError: exceptionToObject,
  })

const readCoverage = () => window.__coverage__

const exceptionToObject = (exception) => {
  // we need to convert error to an object to make it stringifiable
  if (exception && exception instanceof Error) {
    const object = {}
    Object.getOwnPropertyNames(exception).forEach((name) => {
      object[name] = exception[name]
    })
    return object
  }

  return {
    message: exception,
  }
}

const displayErrorInConsole = (error) => {
  console.error(error)
}
