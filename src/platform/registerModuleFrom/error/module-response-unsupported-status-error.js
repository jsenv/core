import { createError } from "./createError.js"

export const createModuleResponseUnsupportedStatusError = ({
  href,
  importerHref,
  status,
  statusText,
}) => {
  return createError({
    href,
    importerHref,
    status,
    statusText,
    code: "MODULE_RESPONSE_UNSUPPORTED_STATUS_ERROR",
    message: createResponseStatusErrorMessage({ href, importerHref, status, statusText }),
  })
}

const createResponseStatusErrorMessage = ({
  href,
  importerHref,
  status,
  statusText,
}) => `module response unsupported status.
href: ${href}
importerHref: ${importerHref}
status: ${status}
statusText: ${statusText}`
