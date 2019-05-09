// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "/.jsenv/node-balancer-data.js"
// eslint-disable-next-line import/no-unresolved
import { resolveNodeGroup } from "/.jsenv/node-group-resolver.js"

const compileId = resolveNodeGroup({ groupMap })

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryPointName}.js`)
