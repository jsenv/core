// eslint-disable-next-line import/no-unresolved
import { compileMap, entryPointFile } from "bundle-node-options"
import { detect } from "../../platform/node/nodeDetect/index.js"
import { nodeToCompileId } from "../../platform/node/nodeToCompileId.js"

const compileId = nodeToCompileId(detect(), compileMap)

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryPointFile}`)
