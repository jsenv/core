import { serveBundle } from "../serve-bundle.js"

export const serveBrowserGlobalBundle = ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  globalThisHelperRelativePath,
  specifierMap,
  specifierDynamicMap,
  sourceRelativePath,
  compileRelativePath,
  sourcemapPath,
  babelPluginMap,
  headers,
  globalName,
}) =>
  serveBundle({
    format: "global",
    formatOutputOptions: globalName
      ? {
          name: globalName,
        }
      : {},
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    globalThisHelperRelativePath,
    specifierMap,
    specifierDynamicMap,
    sourceRelativePath,
    compileRelativePath,
    sourcemapPath,
    babelPluginMap,
    headers,
  })
