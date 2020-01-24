/* global require */
// eslint-disable-next-line import/no-unresolved
import groupMap from "/.jsenv/out/groupMap.json"
// eslint-disable-next-line import/no-unresolved
import env from "/.jsenv/out/env.json"
import { computeCompileIdFromGroupId } from "../platform/computeCompileIdFromGroupId.js"
import { resolvePlatformGroup } from "../platform/resolvePlatformGroup.js"

const { chunkId } = env
const compileId = computeCompileIdFromGroupId({
  groupId: resolvePlatformGroup({ groupMap }),
  groupMap,
})
// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${chunkId}`)
