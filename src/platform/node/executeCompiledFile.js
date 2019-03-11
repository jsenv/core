import { genericExecuteCompiledFile } from "../genericExecuteCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const executeCompiledFile = ({
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  instrument,
}) =>
  genericExecuteCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, sourceOrigin, compileServerOrigin }),
    loadImporter: () => loadImporter({ compileInto, sourceOrigin, compileServerOrigin }),
    compileInto,
    compileServerOrigin,
    filenameRelative,
    collectNamespace,
    collectCoverage,
    instrument,
    readCoverage,
    onError,
    transformError,
  })

const readCoverage = () => global.__coverage__

const onError = (error) => {
  console.error(error)
}

const transformError = (error) => {
  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    return error.error
  }
  return error
}
