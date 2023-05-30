import { fileURLToPath } from "node:url";
import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async ({ remapped, ...params }) => {
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    fileRelativeUrl: `./main.js`,
    allocatedMs: Infinity,
    mirrorConsole: true,
    collectConsole: true,
    ...params,
  });
  const actual = result.namespace.answer;
  const expected = remapped ? 42 : 43;
  assert({ actual, expected });
};

// child process
await test({
  runtime: nodeChildProcess({
    commandLineOptions: [
      `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
    ],
  }),
});
await test({
  runtime: nodeChildProcess({
    commandLineOptions: [
      `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
    ],
    importMap: {
      imports: {
        "./answer.js": "./answer_2.js",
      },
    },
  }),
  remapped: true,
});
await test({
  runtime: nodeWorkerThread({
    commandLineOptions: [
      `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
    ],
  }),
});
// worker thread
await test({
  runtime: nodeWorkerThread({
    commandLineOptions: [
      `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
    ],
    importMap: {
      imports: {
        "./answer.js": "./answer_2.js",
      },
    },
  }),
  remapped: true,
});
