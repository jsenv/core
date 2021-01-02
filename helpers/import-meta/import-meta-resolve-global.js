import url from "./import-meta-url-global.js"

const resolve = async (specifier) => {
  const { getImportResolver } = await import("./getImportResolverForGlobal.js")
  const resolveImport = await getImportResolver(url)
  return resolveImport({ specifier, importer: url })
}

export default resolve
