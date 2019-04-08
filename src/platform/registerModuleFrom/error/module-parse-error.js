import { createError } from "./createError.js"

export const createModuleParseError = ({ href, importerHref, parseError }) => {
  return createError({
    href,
    importerHref,
    parseError,
    code: "MODULE_PARSE_ERROR",
    message: createModuleParseErrorMessage({ href, importerHref, parseError }),
  })
}

const createModuleParseErrorMessage = ({
  href,
  importerHref,
  parseError,
}) => `error while parsing module.
href: ${href}
importerHref: ${importerHref}
parseErrorMessage: ${parseError.message}`
