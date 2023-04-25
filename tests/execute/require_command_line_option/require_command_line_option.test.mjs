import { assert } from "@jsenv/assert"
import { execute, nodeChildProcess } from "@jsenv/core"

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
    commandLineOptions: [`--require=./required.cjs`],
  },
})
