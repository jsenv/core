import { serveBundle } from "../serve-bundle.js"

export const serveBrowserGlobalBundle = ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapRelativePath,
  babelPluginMap,
  headers,
  inlineSpecifierMap,
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
    sourcemapRelativePath,
    babelPluginMap,
    headers,
    inlineSpecifierMap,
  })
