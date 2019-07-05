import { createError } from "./createError.js"

export const createModuleNotFoundError = ({ href, importerHref }) =>
  importerHref
    ? createImportedModuleNotFoundError({ href, importerHref })
    : createMainModuleNotFoundError({ href })

const createImportedModuleNotFoundError = ({ href, importerHref }) =>
  createError({
    code: "MODULE_NOT_FOUND_ERROR",
    message: `imported module not found.
href: ${href}
importer href: ${importerHref}`,
    href,
    importerHref,
  })

const createMainModuleNotFoundError = ({ href }) =>
  createError({
    code: "MODULE_NOT_FOUND_ERROR",
    message: `main module not found.
href: ${href}`,
    href,
  })
