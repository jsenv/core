import { fromFunctionReturningRegisteredModule } from "./fromFunctionReturningRegisteredModule.js"

export const fromFunctionReturningNamespace = (fn, { href, importerHref }) => {
  return fromFunctionReturningRegisteredModule(
    () => {
      // should we compute the namespace here
      // or as it is done below, defer to execute ?
      // I think defer to execute is better
      return [
        [],
        (_export) => {
          return {
            execute: () => {
              const namespace = fn()
              _export(namespace)
            },
          }
        },
      ]
    },
    { href, importerHref },
  )
}
