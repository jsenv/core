export const getNamespaceToRegister = (getNamespace) => {
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
