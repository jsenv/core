import { createError } from "./createError.js"

export const createModuleNotFoundError = ({ file, importerFile }) => {
  return createError({
    file,
    importerFile,
    code: "MODULE_NOT_FOUND_ERROR",
    message: createModuleNotFoundErrorMessage({ file, importerFile }),
  })
}

const createModuleNotFoundErrorMessage = ({ file, importerFile }) => `file not found.
file: ${file}
importerFile: ${importerFile}`
