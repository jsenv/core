import { assert } from "@jsenv/assert"
import {
  ensureEmptyDirectory,
  resolveUrl,
  urlToFileSystemPath,
  writeFile,
  writeSymbolicLink,
} from "@jsenv/filesystem"

import * as resolver from "@jsenv/eslint-import-resolver"

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)

// basic
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl("project/importer", tempDirectoryUrl)
  const resolvedFileUrl = resolveUrl("project/file.js", tempDirectoryUrl)
  const rootDirectoryUrl = resolveUrl("project", tempDirectoryUrl)
  await writeFile(importerFileUrl)
  await writeFile(resolvedFileUrl)

  const actual = resolver.resolve(
    "./File.js",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl,
      logLevel: "error",
    },
  )
  const expected = {
    found: false,
    path: urlToFileSystemPath(
      resolveUrl(
        process.platform === "linux" ? "project/File.js" : "project/file.js",
        tempDirectoryUrl,
      ),
    ),
  }
  assert({ actual, expected })
}

// symlink
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const rootDirectoryUrl = resolveUrl("project", tempDirectoryUrl)
  const importerFileUrl = resolveUrl("project/src/file.js", tempDirectoryUrl)
  const fileUrl = resolveUrl("project/packages/NAME/Dep.js", tempDirectoryUrl)
  const linkUrl = resolveUrl("project/node_modules/NAME", tempDirectoryUrl)
  await writeFile(importerFileUrl)
  await writeFile(fileUrl)
  await writeSymbolicLink({
    from: linkUrl,
    to: resolveUrl("project/packages/NAME", tempDirectoryUrl),
  })

  const actual = resolver.resolve(
    "../node_modules/name/dep.js",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl,
      logLevel: "error",
    },
  )
  const expected = {
    found: false,
    path: urlToFileSystemPath(
      resolveUrl(
        process.platform === "linux"
          ? "project/node_modules/name/dep.js"
          : "project/node_modules/NAME/Dep.js",
        tempDirectoryUrl,
      ),
    ),
  }
  assert({ actual, expected })
}
