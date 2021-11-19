export const textToJavaScriptModule = async ({ code, url }) => {
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
