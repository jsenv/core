import { genericExecuteCompiledFile } from "../genericExecuteCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const executeCompiledFile = ({
  compileInto,
  sourceRootHref,
  compiledRootHref,
  collectNamespace,
  collectCoverage,
  instrument = {},
  pathname,
}) =>
  genericExecuteCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, sourceRootHref }),
    loadImporter: () => loadImporter({ compileInto, sourceRootHref, compiledRootHref }),
    compileInto,
    readCoverage,
    onError,
    transformError,
    compiledRootHref,
    collectNamespace,
    collectCoverage,
    instrument,
    pathname,
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
