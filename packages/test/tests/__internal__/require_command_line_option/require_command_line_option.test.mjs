import { fileURLToPath } from "node:url"
import { assert } from "@jsenv/assert"

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test"

const test = async (params) => {
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    fileRelativeUrl: `./main.js`,
    allocatedMs: Infinity,
    mirrorConsole: true,
    collectConsole: true,
    ...params,
  })
  const actual = result.namespace.answer
  const expected = params.runtimeParams ? "42" : undefined
  assert({ actual, expected })
}

await test({
  runtime: nodeChildProcess,
})
await test({
  runtime: nodeChildProcess,
  runtimeParams: {
    commandLineOptions: [
      `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
    ],
  },
})

await test({
  runtime: nodeWorkerThread,
})
await test({
  runtime: nodeWorkerThread,
  runtimeParams: {
    commandLineOptions: [
      // worker thread needs absolute path, see https://github.com/nodejs/node/issues/41673
      `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
    ],
  },
})
