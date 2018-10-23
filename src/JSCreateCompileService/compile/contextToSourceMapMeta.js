import path from "path"

export const contextToSourceMapMeta = ({ inputName }) => {
  // let's take for example that the client wants to execute src/file.js
  // it will do a GET request to `${compileServer.origin}/build/best/src/file.js`

  // sourceMap will be named file.js.map
  const sourceMapName = `${path.basename(inputName)}.map`

  // it will be located at `${compileServer.origin}/build/src/file.js/e3uiyi456&/file.js.map`
  const sourceMapLocationForSource = `${path.basename(inputName)}__meta__/${sourceMapName}`

  // the name of the source is set to src/file.js
  const sourceNameForSourceMap = inputName

  // source can be fetched at `${compileServer.origin}/src/file.js`
  const sourceLocationForSourceMap = `/${inputName}`

  return {
    sourceMapName,
    sourceLocationForSourceMap,
    sourceMapLocationForSource,
    sourceNameForSourceMap,
  }
}
