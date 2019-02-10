import { generateCompileMap, compileMapToCompileParamMap } from "../../server-compile/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { bundleMain } from "./bundleMain.js"

/*
bundle/
  main.js
    si executé depuis node fait require('./node/main.js')
    si depuis browser inject un script './browser/main.js'

  browser/
    compileMap.json
      contient des infos sur best,worst,otherwise
    main.js
      load compileMap.json
      script load `/${compileId}/index.js`
    best/
      les fichiers compilé pour le profile best
    worst/
      les fichiers compilé pour le profile worst
    otherwise/
      les fichiers compilé pour le profile otherwise

  node/
    compileMap.json
      contient des infos sur best,worst,otherwise
    main.js
      load compileMap.json
      require(`/${compileId}/index.js`)
    best/
      les fichiers compilé pour le profile best
    worst/
      les fichiers compilé pour le profile worst
    otherwise/
      les fichiers compilé pour le profile otherwise
*/

export const bundleNode = async ({
  // todo: add cancellationToken stuff
  root,
  bundleInto = "bundle/node", // later update this to 'dist/node'
  entryPointObject = { main: "index.js" },
  pluginMap = {},
  pluginCompatMap,
  // https://nodejs.org/metrics/summaries/version/nodejs.org-access.log.csv
  usageMap = {
    "0.10": 0.02,
    "0.12": 0.01,
    4: 0.1,
    6: 0.25,
    7: 0.1,
    8: 1,
    9: 0.1,
    10: 0.5,
    11: 0.25,
  },
  compileGroupCount = 2,
}) => {
  if (!root) throw new TypeError(`bundle expect root, got ${root}`)
  if (!bundleInto) throw new TypeError(`bundle expect bundleInto, got ${bundleInto}`)
  if (typeof entryPointObject !== "object")
    throw new TypeError(`bundle expect a entryPointObject, got ${entryPointObject}`)

  const localRoot = root

  const compileMap = generateCompileMap({
    pluginMap,
    pluginCompatMap,
    platformUsageMap: usageMap,
    compileGroupCount,
  })

  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)

  await Promise.all([
    bundlePlatform({
      localRoot,
      bundleInto,
      entryPointObject,
      compileMap,
      platformType: "node",
      compileParamMap,
    }),
    bundleMain({
      localRoot,
      bundleInto,
      entryPointObject,
      compileMap,
      compileParamMap,
    }),
  ])
}
