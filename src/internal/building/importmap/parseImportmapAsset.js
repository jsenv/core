export const parseImportmapAsset = (
  importmapTarget,
  notifiers,
  { minify, importMapToInject },
) => {
  const importmapString = String(importmapTarget.targetBuffer)

  return () => {
    if (importMapToInject) {
      return minify
        ? valueToCompactJsonString(importMapToInject)
        : valueToReadableJsonString(importMapToInject)
    }

    return minify
      ? valueToCompactJsonString(JSON.parse(importmapString))
      : importmapString
  }
}

// removes eventual whitespace in json
const valueToCompactJsonString = (json) => JSON.stringify(json)

// prefer a readable json when minification is disabled
const valueToReadableJsonString = (json) => JSON.stringify(json, null, "  ")
