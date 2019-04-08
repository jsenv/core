import { createError } from "./createError.js"

export const createModuleResponseUnsupportedContentTypeHeaderError = ({
  href,
  importerHref,
  contentType,
}) => {
  return createError({
    href,
    importerHref,
    contentType,
    code: "MODULE_RESPONSE_UNSUPPORTED_CONTENT_TYPE_HEADER_ERROR",
    message: createModuleResponseUnsupportedContentTypeHeaderErrorMessage({
      href,
      importerHref,
      contentType,
    }),
  })
}

const createModuleResponseUnsupportedContentTypeHeaderErrorMessage = ({
  href,
  importerHref,
  contentType,
}) => `module response unsupported content-type header.
href: ${href}
importerHref: ${importerHref}
contentType: ${contentType}`
