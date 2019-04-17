// eslint-disable-next-line import/no-unresolved
import { groupMap, entryPointName } from "\0bundle-node-options.js"
import { detectNode } from "../../node-group-resolver/detectNode.js"
import { nodeToCompileId } from "../../node-group-resolver/nodeToCompileId.js"

const compileId = nodeToCompileId(detectNode(), groupMap)

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryPointName}.js`)
