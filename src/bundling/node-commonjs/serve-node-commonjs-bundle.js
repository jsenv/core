import { serveBundle } from "../serve-bundle.js"

export const serveNodeCommonJsBundle = ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  sourceRelativePath,
  compileRelativePath,
  sourcemapPath,
  babelPluginMap,
  headers,
  inlineSpecifierMap,
}) =>
  serveBundle({
    format: "commonjs",
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    sourceRelativePath,
    compileRelativePath,
    sourcemapPath,
    babelPluginMap,
    headers,
    inlineSpecifierMap,
  })
