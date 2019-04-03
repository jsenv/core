import { createError } from "./createError.js"

export const createModuleParseError = ({ file, importerFile, parseError }) => {
  return createError({
    file,
    importerFile,
    parseError,
    code: "MODULE_PARSE_ERROR",
    message: createModuleParseErrorMessage({ file, importerFile, parseError }),
  })
}

const createModuleParseErrorMessage = ({
  file,
  importerFile,
  parseError,
}) => `error while parsing file.
file: ${file}
importerFile: ${importerFile}
parseErrorMessage: ${parseError.message}`
