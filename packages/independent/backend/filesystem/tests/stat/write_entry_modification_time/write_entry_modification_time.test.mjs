import { assert } from "@jsenv/assert";
import { resolveUrl } from "@jsenv/urls";

import {
  ensureEmptyDirectory,
  readEntryModificationTime,
  writeEntryModificationTime,
  writeFile,
} from "@jsenv/filesystem";
import { toSecondsPrecision } from "@jsenv/filesystem/tests/testHelpers.js";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

{
  const sourceUrl = resolveUrl("file.txt", tempDirectoryUrl);
  const mtime = toSecondsPrecision(Date.now());
  await writeFile(sourceUrl);
  await writeEntryModificationTime(sourceUrl, mtime);

  const actual = toSecondsPrecision(await readEntryModificationTime(sourceUrl));
  const expect = mtime;
  assert({ actual, expect });
}
