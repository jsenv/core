import { createError } from "./createError.js"

export const createModuleInstantiateError = ({ href, importerHref, instantiateError }) => {
  return createError({
    href,
    importerHref,
    instantiateError,
    code: "MODULE_INSTANTIATE_ERROR",
    message: createModuleInstantiateErrorMessage({ href, importerHref, instantiateError }),
  })
}

const createModuleInstantiateErrorMessage = ({
  href,
  importerHref,
  instantiateError,
}) => `error during module instantiation.
href: ${href}
importerHref: ${importerHref}
instantiateErrorMessage: ${instantiateError.message}`
