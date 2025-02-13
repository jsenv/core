import { assert } from "@jsenv/assert";
import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

{
  const withoutEnv = await importOneExportFromFile(
    `${new URL("./exporting_answer.mjs", import.meta.url)}#answer`,
  );
  const withTotoEnv = await importOneExportFromFile(
    `${new URL("./exporting_answer.mjs", import.meta.url)}#answer`,
    {
      env: {
        TOTO: "true",
      },
    },
  );
  const actual = {
    withoutEnv,
    withTotoEnv,
  };
  const expect = {
    withoutEnv: 43,
    withTotoEnv: 42,
  };
  assert({ actual, expect });
}
