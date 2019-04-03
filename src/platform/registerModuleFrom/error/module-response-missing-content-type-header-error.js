import { createError } from "./createError.js"

export const createModuleResponseMissingContentTypeHeaderError = ({ file, importerFile, href }) => {
  return createError({
    file,
    importerFile,
    href,
    code: "MODULE_RESPONSE_MISSING_CONTENT_TYPE_HEADER_ERROR",
    message: createModuleResponseMissingContentTypeHeaderErrorMessage({ file, importerFile, href }),
  })
}

const createModuleResponseMissingContentTypeHeaderErrorMessage = ({
  file,
  importerFile,
  href,
}) => `received no content-type header for file.
file: ${file}
importerFile: ${importerFile}
href: ${href}`
