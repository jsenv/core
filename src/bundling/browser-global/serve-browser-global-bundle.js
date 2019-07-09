import { serveBundle } from "../serve-bundle.js"

export const serveBrowserGlobalBundle = ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapPath,
  specifierMap,
  specifierDynamicMap,
  projectFileRequestedCallback,
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
    sourceRelativePath,
    compileRelativePath,
    sourcemapPath,
    specifierMap,
    specifierDynamicMap,
    projectFileRequestedCallback,
    babelPluginMap,
    headers,
  })
