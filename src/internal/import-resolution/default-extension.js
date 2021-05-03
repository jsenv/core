import { resolveUrl, urlToExtension } from "@jsenv/util"

export const applyDefaultExtension = (specifier, importer) => {
  if (!importer) {
    return specifier
  }

  const importerExtension = urlToExtension(importer)
  const fakeUrl = resolveUrl(specifier, importer)
  const specifierExtension = urlToExtension(fakeUrl)
  if (specifierExtension !== "") {
    return specifier
  }

  // I guess typescript still expect default extension to be .ts
  // in a tsx file.
  if (importerExtension === "tsx") {
    return `${specifier}.ts`
  }

  // extension magic
  return `${specifier}${importerExtension}`
}
