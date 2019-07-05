import { serveBundle } from "../serve-bundle.js"

export const serveBrowserGlobalBundle = ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
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
    specifierMap,
    specifierDynamicMap,
    sourceRelativePath,
    compileRelativePath,
    sourcemapPath,
    babelPluginMap,
    headers,
  })
