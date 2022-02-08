export const jsonToJsModule = async ({ code, url }) => {
  const codeAsJson = JSON.stringify(code)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
  return {
    contentType: "application/javascript",
    content: `export default ${codeAsJson}`,
    sources: [url],
    sourcesContent: [code],
    assets: [],
    assetsContent: [],
  }
}
