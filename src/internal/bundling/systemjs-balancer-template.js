// eslint-disable-next-line import/no-unresolved
import { chunkId, groupMap } from "/.jsenv/env.js"
import { computeCompileIdFromGroupId } from "../compiling/platform-service/computeCompileIdFromGroupId.js"
import { resolvePlatformGroup } from "../compiling/platform-service/resolvePlatformGroup.js"

/* global globalThis */
globalThis.System.register([], (_export, _context) => {
  const execute = async () => {
    const compileId = computeCompileIdFromGroupId({
      groupId: resolvePlatformGroup({ groupMap }),
      groupMap,
    })

    const scriptSrc = `./${compileId}/${chunkId}`

    const namespace = await _context.import(scriptSrc)
    _export(namespace)
  }

  return {
    execute,
  }
})
