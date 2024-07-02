import { assert } from "@jsenv/assert";
import { Abort } from "@jsenv/abort";
import { resolveUrl } from "@jsenv/urls";

import {
  ensureEmptyDirectory,
  collectFiles,
  writeFile,
} from "@jsenv/filesystem";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);

const setup = async () => {
  await ensureEmptyDirectory(tempDirectoryUrl);
  const eUrl = resolveUrl("a/aa/e.js", tempDirectoryUrl);
  const dUrl = resolveUrl("a/d.js", tempDirectoryUrl);
  const cUrl = resolveUrl("b/c.js", tempDirectoryUrl);
  const aUrl = resolveUrl("a.js", tempDirectoryUrl);
  const bUrl = resolveUrl("b.js", tempDirectoryUrl);
  await writeFile(eUrl);
  await writeFile(dUrl);
  await writeFile(cUrl);
  await writeFile(aUrl);
  await writeFile(bUrl);
};

{
  await setup();
  const matchingFileResultArray = await collectFiles({
    directoryUrl: tempDirectoryUrl,
    associations: { source: { "./**/*.js": true } },
    predicate: ({ source }) => source,
  });
  const actual = matchingFileResultArray.map(({ relativeUrl }) => relativeUrl);
  const expect = ["a/aa/e.js", "a/d.js", "b/c.js", "a.js", "b.js"];
  assert({ actual, expect });
}

// abort
{
  await setup();
  const abortController = new AbortController();
  const collectFilePromise = collectFiles({
    signal: abortController.signal,
    directoryUrl: tempDirectoryUrl,
    associations: { source: { "./**/*.js": true } },
    predicate: ({ source }) => source,
  });
  await Promise.resolve();
  abortController.abort();

  try {
    await collectFilePromise;
    throw new Error("should throw");
  } catch (e) {
    const actual = {
      isAbortError: Abort.isAbortError(e),
    };
    const expect = {
      isAbortError: true,
    };
    assert({ actual, expect });
  }
}
