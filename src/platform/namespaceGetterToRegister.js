export const namespaceGetterToRegister = (getNamespace) => {
  return [
    [],
    (_export) => {
      return {
        execute: () => {
          _export(getNamespace())
        },
      }
    },
  ]
}
