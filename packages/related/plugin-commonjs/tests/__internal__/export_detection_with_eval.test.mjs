import { assert } from "@jsenv/assert";
import { fileURLToPath } from "node:url";
import { detectExportsUsingSandboxedRuntime } from "../../src/rollup_plugin_commonjs_named_exports.js";

const names = await detectExportsUsingSandboxedRuntime({
  logger: {
    debug: () => {},
  },
  filePath: fileURLToPath(new URL("./fixtures/file.cjs", import.meta.url)),
});

const actual = names;
const expect = ["toto"];
assert({ actual, expect });
