import { createError } from "./createError.js"

export const createModuleResponseUnsupportedContentTypeHeaderError = ({
  file,
  importerFile,
  href,
  contentType,
}) => {
  return createError({
    file,
    importerFile,
    href,
    contentType,
    code: "MODULE_RESPONSE_UNSUPPORTED_CONTENT_TYPE_HEADER_ERROR",
    message: createModuleResponseUnsupportedContentTypeHeaderErrorMessage({
      file,
      importerFile,
      contentType,
    }),
  })
}

const createModuleResponseUnsupportedContentTypeHeaderErrorMessage = ({
  file,
  importerFile,
  href,
  contentType,
}) => `received unsupported content-type header for file.
file: ${file}
importerFile: ${importerFile}
href: ${href}
contentType: ${contentType}`
