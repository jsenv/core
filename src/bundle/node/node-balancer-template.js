// eslint-disable-next-line import/no-unresolved
import { groupDescription, entryFilenameRelative } from "\0bundle-node-options.js"
import { detect } from "../../platform/node/nodeDetect/index.js"
import { nodeToCompileId } from "../../platform/node/nodeToCompileId.js"

const compileId = nodeToCompileId(detect(), groupDescription)

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryFilenameRelative}`)
