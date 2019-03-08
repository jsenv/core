export const mergeImportMap = (...importMaps) =>
  importMaps.reduce(
    (previous, current) => {
      return {
        imports: { ...previous.imports, ...(current.imports || {}) },
        scopes: { ...previous.scopes, ...(current.scopes || {}) },
      }
    },
    { imports: {}, scopes: {} },
  )
