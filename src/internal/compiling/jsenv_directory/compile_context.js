import { resolveUrl, readFile } from "@jsenv/filesystem"

import {
  TOOLBAR_INJECTOR_BUILD_URL,
  EVENT_SOURCE_CLIENT_BUILD_URL,
  BROWSER_RUNTIME_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const COMPARERS = {
  importDefaultExtension: (a, b) => a === b,
  preservedUrls: (a, b) => valueInArrayAreTheSame(a, b),
  workers: (a, b) => valueInArrayAreTheSame(a, b),
  serviceWorkers: (a, b) => valueInArrayAreTheSame(a, b),
  customCompilerPatterns: (a, b) => valueInArrayAreTheSame(a, b),
  replaceProcessEnvNodeEnv: (a, b) => a === b,
  processEnvNodeEnv: (a, b) => a === b,
  inlineImportMapIntoHTML: (a, b) => a === b,
  jsenvToolbarInjection: (a, b) => a === b,

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
  importDefaultExtension,
  preservedUrls,
  workers,
  serviceWorkers,
  customCompilers,
  replaceProcessEnvNodeEnv,
  processEnvNodeEnv,
  inlineImportMapIntoHTML,
  jsenvToolbarInjection,
}) => {
  return {
    importDefaultExtension,
    preservedUrls,
    workers,
    serviceWorkers,
    customCompilerPatterns: Object.keys(customCompilers),
    replaceProcessEnvNodeEnv,
    processEnvNodeEnv,
    inlineImportMapIntoHTML,
    jsenvToolbarInjection,

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
  const jsenvCoreVersion = await readFile(jsenvCorePackageFileUrl, {
    as: "json",
  }).version
  return jsenvCoreVersion
}

const valueInArrayAreTheSame = (array, secondArray) => {
  return array.every((value) => secondArray.includes(value))
}
