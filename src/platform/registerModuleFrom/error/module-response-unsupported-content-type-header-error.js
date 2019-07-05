import { createError } from "./createError.js"

export const createModuleResponseUnsupportedContentTypeHeaderError = ({
  href,
  contentType,
  importerHref,
}) =>
  importerHref
    ? createImportedModuleResponseUnsupportedContentTypeHeaderError({
        href,
        contentType,
        importerHref,
      })
    : createMainModuleResponseUnsupportedContentTypeHeaderError({ href, contentType })

const createImportedModuleResponseUnsupportedContentTypeHeaderError = ({
  href,
  contentType,
  importerHref,
}) =>
  createError({
    code: "MODULE_RESPONSE_UNSUPPORTED_CONTENT_TYPE_HEADER",
    message: `imported module response unsupported content-type header.
href: ${href}
importer href: ${importerHref}
content-type header: ${contentType}`,
    href,
    importerHref,
  })

const createMainModuleResponseUnsupportedContentTypeHeaderError = ({ href, contentType }) =>
  createError({
    code: "MODULE_RESPONSE_UNSUPPORTED_CONTENT_TYPE_HEADER",
    message: `main module response unsupported content-type header.
href: ${href}
content-type header: ${contentType}`,
    href,
  })
