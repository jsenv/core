// eslint-disable-next-line import/no-unresolved
import { entryPointName, groupMap } from "/.jsenv/systemjs-balancer-data.js"
import { computeCompileIdFromGroupId } from "../compile-server/platform-service/computeCompileIdFromGroupId.js"
import { resolvePlatformGroup } from "../compile-server/platform-service/resolvePlatformGroup.js"

/* global globalThis */
globalThis.System.register([], (_export, _context) => {
  const execute = async () => {
    const compileId = computeCompileIdFromGroupId({
      groupId: resolvePlatformGroup({ groupMap }),
      groupMap,
    })

    const scriptSrc = `./${compileId}/${entryPointName}.js`

    const namespace = await _context.import(scriptSrc)
    _export(namespace)
  }

  return {
    execute,
  }
})
