export const jsonToJsModule = async ({ url, content }) => {
  const codeAsJson = JSON.stringify(content)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
  return {
    contentType: "application/javascript",
    content: `export default ${codeAsJson}`,
    sources: [url],
    sourcesContent: [content],
    assets: [],
    assetsContent: [],
  }
}
