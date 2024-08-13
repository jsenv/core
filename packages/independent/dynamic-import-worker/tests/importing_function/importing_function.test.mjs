import { assert } from "@jsenv/assert";
import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

{
  const withoutParams = await importOneExportFromFile(
    `${new URL("./exporting_getter.mjs", import.meta.url)}#get`,
  );
  const withParam42 = await importOneExportFromFile(
    `${new URL("./exporting_getter.mjs", import.meta.url)}#get`,
    {
      params: 42,
    },
  );
  const actual = {
    withoutParams,
    withParam42,
  };
  const expect = {
    withoutParams: undefined,
    withParam42: 42,
  };
  assert({ actual, expect });
}
