export const jsonToJavaScriptModule = async ({ code, url }) => {
  const codeAsJson = JSON.stringify(code)

  return {
    compiledSource: `export default ${codeAsJson}`,
    contentType: "application/javascript",
    sources: [url],
    sourcesContent: [code],
    assets: [],
    assetsContent: [],
  }
}
