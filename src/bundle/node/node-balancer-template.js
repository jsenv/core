// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "BUNDLE_NODE_DATA.js"
// eslint-disable-next-line import/no-unresolved
import { resolveNodeGroup } from "NODE_GROUP_RESOLVER.js"

const compileId = resolveNodeGroup({ groupMap })

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryPointName}.js`)
