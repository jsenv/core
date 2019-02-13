// eslint-disable-next-line import/no-unresolved
import { groupDescription, entryFile } from "bundle-node-options"
import { detect } from "../../platform/node/nodeDetect/index.js"
import { nodeToCompileId } from "../../platform/node/nodeToCompileId.js"

const compileId = nodeToCompileId(detect(), groupDescription)

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryFile}`)
