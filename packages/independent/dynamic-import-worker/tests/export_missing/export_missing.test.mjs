import { assert } from "@jsenv/assert";
import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

// export missing
try {
  await importOneExportFromFile(
    `${new URL("./exporting_toto.mjs", import.meta.url)}#answer`,
  );
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expect = `No export named "answer" in ${new URL(
    "./exporting_toto.mjs",
    import.meta.url,
  )}`;
  assert({ actual, expect });
}
