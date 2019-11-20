// eslint-disable-next-line import/no-unresolved
import groupMap from ".jsenv/groupMap.json"
// eslint-disable-next-line import/no-unresolved
import { chunkId } from ".jsenv/env.js"
import { computeCompileIdFromGroupId } from "../compiling/platform-service/computeCompileIdFromGroupId.js"
import { resolvePlatformGroup } from "../compiling/platform-service/resolvePlatformGroup.js"

const compileId = computeCompileIdFromGroupId({
  groupId: resolvePlatformGroup({ groupMap }),
  groupMap,
})
// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${chunkId}`)
