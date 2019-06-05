// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "/.jsenv/commonjs-balancer-data.js"
// eslint-disable-next-line import/no-unresolved
import { resolvePlatformGroup } from "/.jsenv/platform-group-resolver.js"

const compileId = resolvePlatformGroup({ groupMap })

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryPointName}.js`)
