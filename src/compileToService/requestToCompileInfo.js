export const ressourceToCompileInfo = (ressource, compileInto) => {
  const parts = ressource.split("/")
  const firstPart = parts[0]
  if (firstPart !== compileInto) {
    return {
      isAsset: false,
      compileId: null,
      file: null,
    }
  }

  const compileId = parts[1]
  if (compileId.length === 0) {
    return {
      isAsset: false,
      compileId: null,
      file: null,
    }
  }

  const file = parts.slice(2).join("/")
  if (file.length === 0) {
    return {
      isAsset: false,
      compileId,
      file: null,
    }
  }

  if (file.match(/[^\/]+__meta__\/.+$/)) {
    return {
      isAsset: true,
      compileId,
      file,
    }
  }

  return {
    isAsset: false,
    compileId,
    file,
  }
}
