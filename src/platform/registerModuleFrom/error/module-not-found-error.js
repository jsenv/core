import { createError } from "./createError.js"

export const createModuleNotFoundError = ({ href, importerHref }) => {
  return createError({
    href,
    importerHref,
    code: "MODULE_NOT_FOUND_ERROR",
    message: createModuleNotFoundErrorMessage({ href, importerHref }),
  })
}

const createModuleNotFoundErrorMessage = ({ href, importerHref }) => `module not found.
href: ${href}
importerHref: ${importerHref}`
