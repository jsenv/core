import { createError } from "./createError.js"

export const createModuleInstantiationError = ({ href, instantiationError, importerHref }) =>
  importerHref
    ? createImportedModuleInstantiationError({ href, instantiationError, importerHref })
    : createMainModuleInstantiationErrorMessage({ href, instantiationError })

const createImportedModuleInstantiationError = ({ href, instantiationError, importerHref }) =>
  createError({
    code: "MODULE_INSTANTIATION_ERROR",
    message: `imported module instantiation error.
href: ${href}
importer href: ${importerHref}
instantiation error message: ${instantiationError.message}`,
    href,
    instantiationError,
    importerHref,
  })

const createMainModuleInstantiationErrorMessage = ({ href, instantiationError }) =>
  createError({
    code: "MODULE_INSTANTIATION_ERROR",
    message: `main module instantiation error.
href: ${href}
instantiation error message: ${instantiationError.message}`,
    href,
    instantiationError,
  })
