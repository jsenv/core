import { uneval } from "@dmail/uneval"
import { serveFile } from "../file-service/index.js"
import { serveBrowsingScript } from "./serve-browsing-script.js"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { compileJs } from "../compiled-js-service/index.js"

export const serveBrowsingPage = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  browserClientFolderRelative,
  compileServerOrigin,
  browsablePredicate,
  method,
  ressource,
  headers,
}) => {
  if (method !== "GET") return null

  if (browsablePredicate(ressource)) {
    return serveFile(`${projectFolder}/${browserClientFolderRelative}/index.html`, { headers })
  }

  // browser script returns a script that will
  // auto execute the ressource, see browsing-script-template/browsing-script-template.js
  if (ressource === "/.jsenv-well-known/browser-script.js") {
    return serveBrowsingScript({
      projectFolder,
      importMapFilenameRelative,
      compileInto,
      babelConfigMap,
      ressource,
      headers,
    })
  }

  // browser client remains unchanged and is served by compile server
  if (ressource === "/.jsenv-well-known/browser-client.js") {
    return {
      status: 307,
      headers: {
        location: `${compileServerOrigin}${ressource}`,
      },
    }
  }

  // browsing-dynamic-data.js exists to allow the dynamic browsing bundle
  // to remain valid if we restart server on a different ip or compileInto
  if (ressource === "/.jsenv-well-known/browsing-dynamic-data.js") {
    const filenameRelative = "/.jsenv-well-known/browsing-dynamic-data.js"

    return serveCompiledFile({
      projectFolder,
      sourceFilenameRelative: filenameRelative,
      compiledFilenameRelative: `${compileInto}/${filenameRelative}`,
      headers,
      compile: async () => {
        const source = generateBrowsingDynamicDataSource({ compileInto, compileServerOrigin })

        return compileJs({
          projectFolder,
          babelConfigMap,
          filenameRelative,
          filename: `${projectFolder}/${filenameRelative}`,
          outputFilename: `file://${projectFolder}/${compileInto}/${filenameRelative}`,
          source,
        })
      },
      clientCompileCacheStrategy: "none",
    })
  }

  return null
}

const generateBrowsingDynamicDataSource = ({
  compileInto,
  compileServerOrigin,
}) => `export const compileInto = ${uneval(compileInto)}
export const compileServerOrigin = ${uneval(compileServerOrigin)}`
