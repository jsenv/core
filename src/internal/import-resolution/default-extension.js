export const applyDefaultExtension = (specifier, importer) => {
  if (!importer) {
    return specifier
  }

  const importerExtension = urlToExtension(importer)
  const fakeUrl = new URL(specifier, importer).href
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

const urlToExtension = (url) => {
  return pathnameToExtension(urlToPathname(url))
}

const urlToPathname = (url) => new URL(url).pathname

const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/")
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1)
  }

  const dotLastIndex = pathname.lastIndexOf(".")
  if (dotLastIndex === -1) return ""
  // if (dotLastIndex === pathname.length - 1) return ""
  const extension = pathname.slice(dotLastIndex)
  return extension
}
