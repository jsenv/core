import { createError } from "./createError.js"

export const createModuleInstantiateError = ({ file, importerFile, instantiateError }) => {
  return createError({
    file,
    importerFile,
    instantiateError,
    code: "MODULE_INSTANTIATE_ERROR",
    message: createModuleInstantiateErrorMessage({ file, importerFile, instantiateError }),
  })
}

const createModuleInstantiateErrorMessage = ({
  file,
  importerFile,
  instantiateError,
}) => `error during file execution.
file: ${file}
importerFile: ${importerFile}
instantiateErrorMessage: ${instantiateError.message}`
