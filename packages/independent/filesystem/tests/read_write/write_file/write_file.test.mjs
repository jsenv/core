import { assert } from "@jsenv/assert";
import { resolveUrl } from "@jsenv/urls";

import { ensureEmptyDirectory, writeFile, readFile } from "@jsenv/filesystem";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

{
  const directoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const fileUrl = resolveUrl("file.txt", directoryUrl);
  await writeFile(fileUrl, "hello world");
  const actual = await readFile(fileUrl, { as: "string" });
  const expect = "hello world";
  assert({ actual, expect });
  await ensureEmptyDirectory(tempDirectoryUrl);
}
