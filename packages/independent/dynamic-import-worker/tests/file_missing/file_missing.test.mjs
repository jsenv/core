import { assert } from "@jsenv/assert";
import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

// file missing
try {
  await importOneExportFromFile(
    `${new URL("./toto.mjs", import.meta.url)}#answer`,
  );
  throw new Error("should throw");
} catch (e) {
  const actual = e;
  const expect = new Error(
    `File not found at ${new URL("./toto.mjs", import.meta.url)}`,
  );
  assert({ actual, expect });
}
