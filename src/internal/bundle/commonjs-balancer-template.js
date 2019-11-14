// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "/.jsenv/commonjs-balancer-data.js"
import { computeCompileIdFromGroupId } from "../compile-server/platform-service/computeCompileIdFromGroupId.js"
import { resolvePlatformGroup } from "../compile-server/platform-service/resolvePlatformGroup.js"

const compileId = computeCompileIdFromGroupId({
  groupId: resolvePlatformGroup({ groupMap }),
  groupMap,
})
// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryPointName}.js`)
