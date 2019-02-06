import { genericExecuteCompiledFile } from "../genericExecuteCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const executeCompiledFile = ({
  compileInto,
  remoteRoot,
  file,
  collectNamespace,
  collectCoverage,
  instrument = {},
}) =>
  genericExecuteCompiledFile({
    loadCompileMeta,
    loadImporter,
    readCoverage,
    onError,
    transformError,
    remoteRoot,
    compileInto,
    file,
    collectNamespace,
    collectCoverage,
    instrument,
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
