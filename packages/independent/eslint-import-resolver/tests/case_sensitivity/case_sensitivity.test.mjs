import { assert } from "@jsenv/assert";
import { urlToFileSystemPath } from "@jsenv/urls";
import {
  ensureEmptyDirectorySync,
  writeFileSync,
  writeSymbolicLinkSync,
} from "@jsenv/filesystem";

import * as resolver from "@jsenv/eslint-import-resolver";

const tempDirectoryUrl = new URL("./temp/", import.meta.url);

const test = async (fn) => {
  ensureEmptyDirectorySync(tempDirectoryUrl);
  try {
    await fn();
  } finally {
    ensureEmptyDirectorySync(tempDirectoryUrl);
  }
};

// basic
test(() => {
  const importerFileUrl = new URL("project/importer", tempDirectoryUrl);
  const resolvedFileUrl = new URL("project/file.js", tempDirectoryUrl);
  const rootDirectoryUrl = new URL("project", tempDirectoryUrl);
  writeFileSync(importerFileUrl);
  writeFileSync(resolvedFileUrl);

  const actual = resolver.resolve(
    "./File.js",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl,
      logLevel: "error",
    },
  );
  const expected = {
    found: false,
    path: urlToFileSystemPath(
      new URL(
        process.platform === "linux" ? "project/File.js" : "project/file.js",
        tempDirectoryUrl,
      ),
    ),
  };
  assert({ actual, expected });
});

// symlink
test(() => {
  const rootDirectoryUrl = new URL("project", tempDirectoryUrl);
  const importerFileUrl = new URL("project/src/file.js", tempDirectoryUrl);
  const fileUrl = new URL("project/packages/NAME/Dep.js", tempDirectoryUrl);
  const linkUrl = new URL("project/node_modules/NAME", tempDirectoryUrl);
  writeFileSync(importerFileUrl);
  writeFileSync(fileUrl);
  writeSymbolicLinkSync({
    from: linkUrl,
    to: new URL("project/packages/NAME", tempDirectoryUrl),
  });

  const actual = resolver.resolve(
    "../node_modules/name/dep.js",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl,
      logLevel: "error",
    },
  );
  const expected = {
    found: false,
    path: urlToFileSystemPath(
      new URL(
        process.platform === "linux"
          ? "project/node_modules/name/dep.js"
          : "project/node_modules/NAME/Dep.js",
        tempDirectoryUrl,
      ),
    ),
  };
  assert({ actual, expected });
});
