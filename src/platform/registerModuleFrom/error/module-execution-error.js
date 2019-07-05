import { createError } from "./createError.js"

export const createModuleExecutionError = ({ href, executionError, importerHref }) =>
  importerHref
    ? createImportedModuleExecutionError({ href, executionError, importerHref })
    : createMainModuleExecutionError({ href, executionError })

const createImportedModuleExecutionError = ({ href, executionError, importerHref }) =>
  createError({
    code: "MODULE_EXECUTION_ERROR",
    message: `imported module execution error.
href: ${href}
importer href: ${importerHref}
execution error message: ${executionError.message}`,
    href,
    executionError,
    importerHref,
  })

const createMainModuleExecutionError = ({ href, executionError }) =>
  createError({
    code: "MODULE_EXECUTION_ERROR",
    message: `main module execution error.
href: ${href}
execution error message: ${executionError.message}`,
    href,
    executionError,
  })
