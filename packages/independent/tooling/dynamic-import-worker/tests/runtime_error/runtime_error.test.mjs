import { assert } from "@jsenv/assert";
import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

// runtime error
try {
  await importOneExportFromFile(
    `${new URL("./runtime_error.mjs", import.meta.url)}#answer`,
  );
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expect = "here";
  assert({ actual, expect });
}
