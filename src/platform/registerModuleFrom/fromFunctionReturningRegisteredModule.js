import { createModuleInstantiateError } from "./error/module-instantiate-error.js"

export const fromFunctionReturningRegisteredModule = (fn, { href, importerHref }) => {
  try {
    return fn()
  } catch (error) {
    throw createModuleInstantiateError({ href, importerHref, instantiateError: error })
  }
}
