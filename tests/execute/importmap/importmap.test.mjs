import { fileURLToPath } from "node:url"
import { assert } from "@jsenv/assert"
import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/core"

const test = async (params) => {
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    fileRelativeUrl: `./main.js`,
    allocatedMs: Infinity,
    mirrorConsole: true,
    collectConsole: true,
    runtimeParams: {
      commandLineOptions: [
        // worker thread needs absolute path, see https://github.com/nodejs/node/issues/41673
        `--require=${fileURLToPath(
          new URL("./required.cjs", import.meta.url),
        )}`,
      ],
    },
    ...params,
  })
  const actual = result.namespace.answer
  const expected = params.importMap ? 42 : 43
  assert({ actual, expected })
}

// child process
await test({
  runtime: nodeChildProcess,
})
await test({
  runtime: nodeChildProcess,
  importMap: {
    imports: {
      "./answer.js": "./answer_2.js",
    },
  },
})
await test({
  runtime: nodeChildProcess,
})
// worker thread
await test({
  runtime: nodeWorkerThread,
  importMap: {
    imports: {
      "./answer.js": "./answer_2.js",
    },
  },
})
