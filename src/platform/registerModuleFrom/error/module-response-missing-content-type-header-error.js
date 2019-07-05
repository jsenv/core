import { createError } from "./createError.js"

export const createModuleResponseMissingContentTypeHeaderError = ({
  href,
  instantiationError,
  importerHref,
}) =>
  importerHref
    ? createImportedModuleResponseMissingContentTypeHeaderError({
        href,
        instantiationError,
        importerHref,
      })
    : createMainModuleResponseMissingContentTypeHeaderError({ href, instantiationError })

const createImportedModuleResponseMissingContentTypeHeaderError = ({ href, importerHref }) =>
  createError({
    code: "MODULE_RESPONSE_MISSING_CONTENT_TYPE_HEADER_ERROR",
    message: `imported module response is missing a content-type header.
href: ${href}
importer href: ${importerHref}`,
    href,
    importerHref,
  })

const createMainModuleResponseMissingContentTypeHeaderError = ({ href }) =>
  createError({
    code: "MODULE_RESPONSE_MISSING_CONTENT_TYPE_HEADER_ERROR",
    message: `main module response is missing a content-type header.
href: ${href}`,
    href,
  })
