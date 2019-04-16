import { uneval } from "@dmail/uneval"
import { ROOT_FOLDER } from "../../ROOT_FOLDER.js"
import { bundleBrowser } from "../../bundle/browser/bundleBrowser.js"
import { compileFile } from "../compile-file/index.js"

export const compileBrowserClient = async ({
  projectFolder,
  compileInto,
  babelConfigMap,
  groupMap,
  headers,
}) => {
  const browserClientFilenameJsenvRelative = "src/platform/browser/browserPlatform.js"
  const browserBalancerFilenameJsenvRelative = "src/browser-compile-id/computeBrowserCompileId.js"
  const insideJsenv = projectFolder.startsWith(`${ROOT_FOLDER}/`)

  const browserClientFilename = insideJsenv
    ? `${ROOT_FOLDER}/${compileInto}/${browserClientFilenameJsenvRelative}`
    : `${projectFolder}/${compileInto}/${browserClientFilenameJsenvRelative}`
  const browserClientCompiledFilenameRelative = insideJsenv
    ? `${compileInto}/${browserClientFilenameJsenvRelative}`
    : `${compileInto}/node_module/@jsenv/core/${browserClientFilenameJsenvRelative}`
  const browserClientCompiledFilename = `${projectFolder}/${browserClientCompiledFilenameRelative}`

  debugger
  // oui en fait compileFile aurait besoin d'un coup de pouce ici
  // parce que l'endroit ou se trouve le fichier n'est pas celui
  // ou on le met
  // en plus compileFile a pas besoin du filename
  // s'il a deja le filenameRelative
  // il faut donc un sourceFilenameRelative
  // et un compiledFilenameRelative qui vaudrait le sourceFilenameRelative ?
  // genre si je compile '/src/file.js'
  // le sourceFilenameRelative, ouais ok
  // et donc le compiledFilenameRelative sera `/dist/src/file.js`

  // const browserBalancerFilenameRelative = insideJsenv
  //   ? browserBalancerFilenameJsenvRelative
  //   : `node_module/@jsenv/core/${browserBalancerFilenameJsenvRelative}`
  const browserBalancerFilename = insideJsenv
    ? `${ROOT_FOLDER}/${browserBalancerFilenameJsenvRelative}`
    : `${projectFolder}/${browserBalancerFilenameJsenvRelative}`

  return compileFile({
    projectFolder,
    headers,
    filenameRelative: browserClientCompiledFilenameRelative,
    filename: browserClientCompiledFilename,
    compile: async () => {
      const bundle = await bundleBrowser({
        // the projectFolder is the root folder
        // except if you pass a custom one, but we'll see that later ?
        projectFolder: insideJsenv ? ROOT_FOLDER : projectFolder,
        inlineSpecifierMap: {
          ["JSENV_BROWSER_CLIENT.js"]: browserClientFilename,
          ["COMPUTE_BROWSER_COMPILE_ID"]: browserBalancerFilename,
          ["PLATFORM_META"]: () => `export const groupMap = ${uneval(groupMap)}`,
        },
        entryPointMap: {
          main: "JSENV_BROWSER_CLIENT.js",
        },
        babelConfigMap,
        minify: false,
        throwUnhandled: false,
        compileGroupCount: 1,
      })
      const main = bundle.output[0]
      return {
        compiledSource: main.code,
        sources: main.map.sources,
        sourcesContent: main.map.sourcesContent,
        assets: ["main.map.js"],
        assetsSource: [JSON.stringify(main.map)],
        compiledSourceFileWritten: true, // already written by rollup
        assetsFileWritten: true, // already written by
      }
    },
    // for now disable cache for client because veryfing
    // it would mean ensuring the whole bundle is still valid
    // I suspect it is faster to regenerate the bundle than check
    // if it's still valid.
    clientCompileCacheStrategy: "none",
  })
}
