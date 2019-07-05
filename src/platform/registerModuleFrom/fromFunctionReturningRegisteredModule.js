import { createModuleInstantiationError } from "./error/module-instantiation-error.js"

export const fromFunctionReturningRegisteredModule = (fn, { href, importerHref }) => {
  try {
    return fn()
  } catch (error) {
    throw createModuleInstantiationError({ href, instantiationError: error, importerHref })
  }
}
