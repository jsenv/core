import { createError } from "./createError.js"

export const createModuleResponseMissingContentTypeHeaderError = ({ href, importerHref }) => {
  return createError({
    href,
    importerHref,
    code: "MODULE_RESPONSE_MISSING_CONTENT_TYPE_HEADER_ERROR",
    message: createModuleResponseMissingContentTypeHeaderErrorMessage({ href, importerHref }),
  })
}

const createModuleResponseMissingContentTypeHeaderErrorMessage = ({
  href,
  importerHref,
}) => `module response missing content-type header.
href: ${href}
importerHref: ${importerHref}`
