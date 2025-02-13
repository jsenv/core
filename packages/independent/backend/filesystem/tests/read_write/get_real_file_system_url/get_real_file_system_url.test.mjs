import { assert } from "@jsenv/assert";
import { resolveUrl } from "@jsenv/urls";

import {
  ensureEmptyDirectory,
  getRealFileSystemUrlSync,
  writeFile,
  writeSymbolicLink,
} from "@jsenv/filesystem";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);

// basic
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const caseSensitiveFileUrl = resolveUrl("SRC/File.js", tempDirectoryUrl);
  const fileUrl = resolveUrl("src/file.js", tempDirectoryUrl);
  await writeFile(caseSensitiveFileUrl);
  const realFileSystemUrl = getRealFileSystemUrlSync(fileUrl);
  const actual = {
    realFileSystemUrl,
  };
  const expect = {
    realFileSystemUrl: caseSensitiveFileUrl,
  };
  assert({ actual, expect });
}

// with symlink
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const linkUrl = resolveUrl("node_modules/name", tempDirectoryUrl);
  const fileUrl = resolveUrl("PackaGes/Name/fIle.js", tempDirectoryUrl);
  const fileUrlBeforeLink = resolveUrl(
    "node_modules/name/fIle.js",
    tempDirectoryUrl,
  );
  const facadeFileUrl = resolveUrl(
    "node_modules/name/file.js",
    tempDirectoryUrl,
  );
  await writeFile(fileUrl);
  await writeSymbolicLink({
    from: linkUrl,
    // on Linux the symlink is case sensitive
    // meaning we must pass "PackaGes/Name" and not "packages/name"
    // otherwise, doing a readFileSync on facadeFileUrl results in ENOENT.
    // on Mac or windows this is not required
    to: resolveUrl("PackaGes/Name", tempDirectoryUrl),
  });
  const fileRealUrl = getRealFileSystemUrlSync(facadeFileUrl);
  const fileRealUrlBeforeLink = getRealFileSystemUrlSync(facadeFileUrl, {
    followLink: false,
  });
  const actual = {
    fileRealUrl,
    fileRealUrlBeforeLink,
  };
  const expect = {
    fileRealUrl: fileUrl,
    fileRealUrlBeforeLink: fileUrlBeforeLink,
  };
  assert({ actual, expect });
}
