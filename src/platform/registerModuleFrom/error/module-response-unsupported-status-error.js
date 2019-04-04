import { createError } from "./createError.js"

export const createModuleResponseUnsupportedStatusError = ({
  file,
  importerFile,
  href,
  status,
  statusText,
}) => {
  return createError({
    file,
    importerFile,
    href,
    status,
    statusText,
    code: "MODULE_RESPONSE_UNSUPPORTED_STATUS_ERROR",
    message: createResponseStatusErrorMessage({ file, importerFile, href, status, statusText }),
  })
}

const createResponseStatusErrorMessage = ({
  file,
  importerFile,
  href,
  status,
  statusText,
}) => `server responded with unexpected status.
file: ${file}
importerFile: ${importerFile}
href: ${href}
status: ${status}
statusText: ${statusText}`
