export const parseImportmapRessource = (
  importmapRessource,
  notifiers,
  { minify, importMapToInject },
) => {
  const importmapString = String(importmapRessource.bufferBeforeBuild)

  return () => {
    if (importMapToInject) {
      const jsonText = minify
        ? valueToCompactJsonString(importMapToInject)
        : valueToReadableJsonString(importMapToInject)
      importmapRessource.buildEnd(jsonText)
      return
    }

    const jsonText = minify
      ? valueToCompactJsonString(JSON.parse(importmapString))
      : importmapString
    importmapRessource.buildEnd(jsonText)
  }
}

// removes eventual whitespace in json
const valueToCompactJsonString = (json) => JSON.stringify(json)

// prefer a readable json when minification is disabled
const valueToReadableJsonString = (json) => JSON.stringify(json, null, "  ")
