import { assert } from "@jsenv/assert";
import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

{
  const actual = await importOneExportFromFile(
    `${new URL("./exporting_answer.mjs", import.meta.url)}#answer`,
  );
  const expect = 42;
  assert({ actual, expect });
}
