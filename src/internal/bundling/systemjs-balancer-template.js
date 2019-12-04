// eslint-disable-next-line import/no-unresolved
import groupMap from "/.jsenv/out/groupMap.json"
// eslint-disable-next-line import/no-unresolved
import { chunkId } from "/.jsenv/out/env.js"
import { computeCompileIdFromGroupId } from "../platform/computeCompileIdFromGroupId.js"
import { resolvePlatformGroup } from "../platform/resolvePlatformGroup.js"

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
