// eslint-disable-next-line import/no-unresolved
import groupMap from "/.jsenv/out/groupMap.json"
// eslint-disable-next-line import/no-unresolved
import env from "/.jsenv/out/env.json"
import { computeCompileIdFromGroupId } from "../runtime/computeCompileIdFromGroupId.js"
import { resolveRuntimeGroup } from "../runtime/resolveRuntimeGroup.js"

const { chunkId } = env

/* global globalThis */
globalThis.System.register([], (_export, _context) => {
  const execute = async () => {
    const compileId = computeCompileIdFromGroupId({
      groupId: resolveRuntimeGroup({ groupMap }),
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
