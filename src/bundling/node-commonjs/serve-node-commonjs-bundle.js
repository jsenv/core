import { serveBundle } from "../serve-bundle.js"

export const serveNodeCommonJsBundle = ({
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
}) =>
  serveBundle({
    format: "commonjs",
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
