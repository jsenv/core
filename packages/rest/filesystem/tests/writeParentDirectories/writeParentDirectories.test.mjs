import { assert } from "@jsenv/assert";
import { resolveUrl } from "@jsenv/urls";

import {
  writeDirectory,
  ensureEmptyDirectory,
  ensureParentDirectories,
} from "@jsenv/filesystem";
import { testDirectoryPresence } from "@jsenv/filesystem/tests/testHelpers.js";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

// destination parent does not exists
{
  const parentDirectoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dir/file.js", tempDirectoryUrl);

  await ensureParentDirectories(destinationUrl);
  const actual = await testDirectoryPresence(parentDirectoryUrl);
  const expected = true;
  assert({ actual, expected });
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// destination parent is a directory
{
  const parentDirectoryUrl = resolveUrl("dir/", tempDirectoryUrl);
  const destinationUrl = resolveUrl("dir/file.js", tempDirectoryUrl);
  await writeDirectory(parentDirectoryUrl);

  await ensureParentDirectories(destinationUrl);
  const actual = await testDirectoryPresence(parentDirectoryUrl);
  const expected = true;
  assert({ actual, expected });
  await ensureEmptyDirectory(tempDirectoryUrl);
}
