export const textToJavaScriptModule = async ({ code, url }) => {
  return {
    compiledSource: `export default "${JSON.stringify(code)}"`,
    contentType: "application/javascript",
    sources: [url],
    sourcesContent: [code],
    assets: [],
    assetsContent: [],
  }
}
