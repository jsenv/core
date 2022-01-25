import { resolveUrl, readFile } from "@jsenv/filesystem"

import {
  TOOLBAR_INJECTOR_BUILD_URL,
  EVENT_SOURCE_CLIENT_BUILD_URL,
  BROWSER_RUNTIME_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

import {
  sameValuesInTwoArrays,
  sameValueInTwoObjects,
} from "./comparison_utils.js"

const COMPARERS = {
  preservedUrls: sameValueInTwoObjects,
  workers: sameValuesInTwoArrays,
  serviceWorkers: sameValuesInTwoArrays,
  replaceProcessEnvNodeEnv: (a, b) => a === b,
  inlineImportMapIntoHTML: (a, b) => a === b,

  jsenvCorePackageVersion: (a, b) => a === b,
  TOOLBAR_INJECTOR_BUILD_URL: (a, b) => a === b,
  EVENT_SOURCE_CLIENT_BUILD_URL: (a, b) => a === b,
  BROWSER_RUNTIME_BUILD_URL: (a, b) => a === b,
}

export const compareCompileContexts = (
  compileContext,
  secondCompileContext,
) => {
  return Object.keys(COMPARERS).every((key) => {
    return COMPARERS[key](compileContext[key], secondCompileContext[key])
  })
}

export const createCompileContext = async ({
  preservedUrls,
  workers,
  serviceWorkers,
  replaceProcessEnvNodeEnv,
  inlineImportMapIntoHTML,
}) => {
  return {
    preservedUrls,
    workers,
    serviceWorkers,
    replaceProcessEnvNodeEnv,
    inlineImportMapIntoHTML,

    // when "jsenvCorePackageVersion" is different, it means compile logic may have changed
    jsenvCorePackageVersion: await readJsenvCoreVersionFromPackageFile(),
    TOOLBAR_INJECTOR_BUILD_URL,
    EVENT_SOURCE_CLIENT_BUILD_URL,
    BROWSER_RUNTIME_BUILD_URL,
  }
}

const readJsenvCoreVersionFromPackageFile = async () => {
  const jsenvCorePackageFileUrl = resolveUrl(
    "./package.json",
    jsenvCoreDirectoryUrl,
  )
  const jsenvCorePackage = await readFile(jsenvCorePackageFileUrl, {
    as: "json",
  })
  const version = jsenvCorePackage.version
  return version
}
