import url from "./import-meta-url-commonjs.js"

const resolve = async (specifier) => {
  const { getImportResolver } = await import("./getImportResolverForCommonjs.js")
  const resolveImport = await getImportResolver(url)
  return resolveImport({ specifier, importer: url })
}

export default resolve
