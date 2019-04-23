import { uneval } from "@dmail/uneval"
import { serveFile } from "../file-service/index.js"
import {
  WELL_KNOWN_BROWSING_BUNDLE_DYNAMIC_DATA_PATHNAME,
  serveBrowsingBundle,
} from "./serve-browsing-bundle.js"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { compileJs } from "../compiled-js-service/index.js"
import { WELL_KNOWN_SYSTEM_PATHNAME } from "../system-service/index.js"
import { WELL_KNOWN_BROWSER_PLATFORM_PATHNAME } from "../browser-platform-service/index.js"

const WELL_KNOWN_BROWSER_SCRIPT_PATHNAME = "/.jsenv-well-known/browser-script.js"

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

  // system.js redirected to compile server
  if (ressource === WELL_KNOWN_SYSTEM_PATHNAME) {
    return {
      status: 307,
      headers: {
        location: `${compileServerOrigin}${ressource}`,
      },
    }
  }

  // browser-script.js returns a self executing bundle
  if (ressource === WELL_KNOWN_BROWSER_SCRIPT_PATHNAME) {
    return serveBrowsingBundle({
      projectFolder,
      importMapFilenameRelative,
      compileInto,
      babelConfigMap,
      ressource,
      headers,
    })
  }

  // browser-platform.js redirect to compile server
  if (ressource === WELL_KNOWN_BROWSER_PLATFORM_PATHNAME) {
    return {
      status: 307,
      headers: {
        location: `${compileServerOrigin}${ressource}`,
      },
    }
  }

  // browsing-dynamic-data.js exists to allow the dynamic browsing bundle
  // to remain valid if we restart server on a different ip or compileInto
  if (ressource === WELL_KNOWN_BROWSING_BUNDLE_DYNAMIC_DATA_PATHNAME) {
    return serveDynamicDataFile({
      projectFolder,
      compileInto,
      babelConfigMap,
      compileServerOrigin,
      headers,
    })
  }

  return null
}

const serveDynamicDataFile = ({
  projectFolder,
  compileInto,
  babelConfigMap,
  compileServerOrigin,
  headers,
}) => {
  const filenameRelative = WELL_KNOWN_BROWSING_BUNDLE_DYNAMIC_DATA_PATHNAME.slice(1)

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

const generateBrowsingDynamicDataSource = ({
  compileInto,
  compileServerOrigin,
}) => `export const compileInto = ${uneval(compileInto)}
export const compileServerOrigin = ${uneval(compileServerOrigin)}`
