import { createError } from "./createError.js"

export const createModuleResponseUnsupportedStatusError = ({
  href,
  status,
  statusText,
  importerHref,
}) =>
  importerHref
    ? createImportedModuleResponseUnsupportedContentTypeHeaderError({
        href,
        status,
        statusText,
        importerHref,
      })
    : createMainModuleResponseUnsupportedContentTypeHeaderError({ href, status, statusText })

const createImportedModuleResponseUnsupportedContentTypeHeaderError = ({
  href,
  status,
  statusText,
  importerHref,
}) =>
  createError({
    code: "MODULE_RESPONSE_UNSUPPORTED_STATUS",
    message: `imported module response unsupported status.
href: ${href}
importerHref: ${importerHref}
status: ${status}
statusText: ${statusText}`,
    href,
    status,
    statusText,
    importerHref,
  })

const createMainModuleResponseUnsupportedContentTypeHeaderError = ({ href, status, statusText }) =>
  createError({
    code: "MODULE_RESPONSE_UNSUPPORTED_STATUS",
    message: `main module response unsupported status.
href: ${href}
status: ${status}
statusText: ${statusText}`,
    href,
    status,
    statusText,
  })
