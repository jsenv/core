// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "/.jsenv/commonjs-balancer-data.js"
// eslint-disable-next-line import/no-unresolved
import { resolvePlatformGroup } from "/.jsenv/platform-group-resolver.js"
import { resolveCompileId } from "../../balancing/compile-id-resolution.js"

const compileId = resolveCompileId({
  groupId: resolvePlatformGroup({ groupMap }),
  groupMap,
})
// eslint-disable-next-line import/no-dynamic-require
module.exports = require(`./${compileId}/${entryPointName}.js`)
