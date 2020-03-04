/* global require */
// eslint-disable-next-line import/no-unresolved
import groupMap from "/.jsenv/out/groupMap.json"
// eslint-disable-next-line import/no-unresolved
import env from "/.jsenv/out/env.json"
import { computeCompileIdFromGroupId } from "../runtime/computeCompileIdFromGroupId.js"
import { resolveRuntimeGroup } from "../runtime/resolveRuntimeGroup.js"

const { chunkId } = env
const compileId = computeCompileIdFromGroupId({
  groupId: resolveRuntimeGroup({ groupMap }),
  groupMap,
})
// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${chunkId}`)
