// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "/.jsenv/commonjs-balancer-data.js"
// eslint-disable-next-line import/no-unresolved
import { resolveGroup } from "/.jsenv/platform-group-resolver.js"

const compileId = resolveGroup({ groupMap })

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryPointName}.js`)
