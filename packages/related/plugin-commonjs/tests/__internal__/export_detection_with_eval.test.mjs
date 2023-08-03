import { fileURLToPath } from "node:url";
import { assert } from "@jsenv/assert";

import { detectExportsUsingSandboxedRuntime } from "../../src/rollup_plugin_commonjs_named_exports.js";

const names = await detectExportsUsingSandboxedRuntime({
  logger: {
    debug: () => {},
  },
  filePath: fileURLToPath(new URL("./fixtures/file.cjs", import.meta.url)),
});

const actual = names;
const expected = ["toto"];
assert({ actual, expected });
