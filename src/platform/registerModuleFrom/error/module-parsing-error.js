import { createError } from "./createError.js"

export const createModuleParsingError = ({ href, parsingError, importerHref }) =>
  importerHref
    ? createImportedModuleParsingError({ href, parsingError, importerHref })
    : createMainModuleParsingError({ href, parsingError })

const createImportedModuleParsingError = ({ href, parsingError, importerHref }) =>
  createError({
    code: "MODULE_PARSING_ERROR",
    message: `imported module parsing error.
href: ${href}
importer href: ${importerHref}
parsing error message: ${parsingError.message}`,
    href,
    parsingError,
    importerHref,
  })

const createMainModuleParsingError = ({ href, parsingError }) =>
  createError({
    code: "MODULE_PARSING_ERROR",
    message: `main module parsing error.
href: ${href}
parsing error message: ${parsingError.message}`,
    href,
    parsingError,
  })
