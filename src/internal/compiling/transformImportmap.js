import { loggerToLogLevel } from "@jsenv/logger"
import { urlToRelativeUrl } from "@jsenv/util"
import { composeTwoImportMaps } from "@jsenv/import-map"
import { getImportMapFromNodeModules } from "@jsenv/node-module-import-map"
import { readProjectImportMap } from "./readProjectImportMap.js"

/**
 * generateImportMapForCompileServer allows the following:
 *
 * import importMap from '/jsenv.importmap'
 *
 * returns the project importMap.
 * Note that if importMap file does not exists an empty object is returned.
 * Note that if project uses a custom importMapFileRelativeUrl jsenv internal import map
 * remaps '/jsenv.importmap' to the real importMap
 *
 * This pattern exists so that jsenv can resolve some dynamically injected import such as
 *
 * @jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js
 */

export const transformImportmap = async (
  importmapBeforeTransformation,
  {
    logger,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
    importMapFileRelativeUrl,
    originalFileUrl,
    // compiledFileUrl,
    projectFileRequestedCallback,
    request,
  },
) => {
  // send out/best/*.importmap untouched

  projectFileRequestedCallback(urlToRelativeUrl(originalFileUrl, projectDirectoryUrl), request)

  const importMapForJsenvCore = await getImportMapFromNodeModules({
    logLevel: loggerToLogLevel(logger),
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    rootProjectDirectoryUrl: projectDirectoryUrl,
    projectPackageDevDependenciesIncluded: false,
  })
  const importmapForSelfImport = {
    imports: {
      "@jsenv/core/": `./${urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)}`,
    },
  }

  // lorsque /.jsenv/out n'est pas la ou on l'attends
  // il faut alors faire un scope /.jsenv/out/ qui dit hey
  const importMapInternal = {
    imports: {
      ...(outDirectoryRelativeUrl === ".jsenv/out/"
        ? {}
        : {
            "/.jsenv/out/": `./${outDirectoryRelativeUrl}`,
          }),
      "/jsenv.importmap": `./${importMapFileRelativeUrl}`,
    },
  }

  const importMapForProject = await readProjectImportMap({
    projectDirectoryUrl,
    importMapFileRelativeUrl,
  })

  const importMap = [
    importMapForJsenvCore,
    importmapForSelfImport,
    importMapInternal,
    importMapForProject,
  ].reduce((previous, current) => composeTwoImportMaps(previous, current), {})

  return {
    compiledSource: JSON.stringify(importMap, null, "  "),
    contentType: "application/importmap+json",
    sources: [originalFileUrl],
    sourcesContent: [importmapBeforeTransformation],
    assets: [],
    assetsContent: [],
  }
}
