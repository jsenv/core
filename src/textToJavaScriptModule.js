import { readFile } from "@jsenv/filesystem"

export const textToJavaScriptModule = async ({ url }) => {
  const code = await readFile(url)

  const codeAsJson = JSON.stringify(code)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")

  return {
    compiledSource: `export default ${codeAsJson}`,
    contentType: "application/javascript",
    sources: [url],
    sourcesContent: [code],
    assets: [],
    assetsContent: [],
  }
}
