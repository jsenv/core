# API

All the functions exported by `@jsenv/filesystem`

# assertAndNormalizeDirectoryUrl

_assertAndNormalizeDirectoryUrl_ is a function ensuring the received value can be normalized to a directory url string. This function is great to make a function accept various values as directory url and normalize it to a standard directory url like `"file:///directory/"`.

```js
import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"

assertAndNormalizeDirectoryUrl("/directory") // "file:///directory/"
assertAndNormalizeDirectoryUrl("C:\\directory") // "file://C:/directory/"
```

# assertAndNormalizeFileUrl

_assertAndNormalizeFileUrl_ is a function ensuring the received value can be normalized to a file url string. This function is great to make a function accept various values as file url and normalize it to a standard file url like `"file:///directory/file.js"`.

```js
import { assertAndNormalizeFileUrl } from "@jsenv/filesystem"

assertAndNormalizeFileUrl("/directory/file.js") // file:///directory/file.js
assertAndNormalizeFileUrl("C:\\directory\\file.js") // file:///C:/directory/file.js
```

# assertDirectoryPresence

_assertDirectoryPresence_ is an async function throwing if directory does not exists on the filesystem. This function is great when code expects a directory to exist before going further.

```js
import { assertDirectoryPresence } from "@jsenv/filesystem"

await assertDirectoryPresence("file:///Users/directory/")
```

# assertFilePresence

_assertFilePresence_ is an async function throwing if a file does not exists on the filesystem. This function is great to when code expects a file to exist before going further.

```js
import { assertFilePresence } from "@jsenv/filesystem"

await assertFilePresence("file:///Users/directory/file.js")
```

# bufferToEtag

_bufferToEtag_ is a function receiving a buffer and converting it into an eTag. This function returns a hash (a small string) representing a file content. You can later check if the file content has changed by comparing a previously generated eTag with the current file content.

```js
import { bufferToEtag } from "@jsenv/filesystem"

const eTag = bufferToEtag(Buffer.from("Hello world"))
const otherEtag = bufferToEtag(Buffer.from("Hello world"))
eTag === otherEtag // true
```

# collectFiles

_collectFiles_ is an async function collectings a subset of files inside a directory.

```js
import { collectFiles } from "@jsenv/filesystem"

const files = await collectFiles({
  directoryUrl: "file:///Users/you/directory",
  structuredMetaMap: {
    whatever: {
      "./**/*.js": 42,
    },
  },
  predicate: (meta) => {
    return meta.whatever === 42
  },
})
```

# comparePathnames

_comparePathnames_ is a function compare two pathnames and returning which pathnames comes first in a filesystem.

```js
import { comparePathnames } from "@jsenv/filesystem"

const pathnames = ["a/b.js", "a.js"]
pathnames.sort(comparePathnames)
```

# copyEntry

_copyEntry_ is an async function creating a copy of the filesystem node at a given destination

```js
import { copyEntry } from "@jsenv/filesystem"

await copyEntry({
  from: `file:///file.js`,
  to: "file:///destination/file.js",
})
await copyEntry({
  from: `file:///directory`,
  to: "file:///destination/directory",
})
```

# ensureEmptyDirectory

_ensureEmptyDirectory_ is an async function ensuring a directory is empty. It removes a directory content when it exists or create an empty directory.
This function was written for testing. It is meant to clean up a directory in case a previous test execution let some files and you want to clean them before running your test.

```js
import { ensureEmptyDirectory } from "@jsenv/filesystem"

await ensureEmptyDirectory(`file:///directory`)
```

# ensureParentDirectories

_ensureParentDirectories_ is an async function creating every directory leading to a file. This function is useful to ensure a given file directories exists before doing any operation on that file.

```js
import { ensureParentDirectories } from "@jsenv/filesystem"

await ensureParentDirectories(`file:///directory/subdirectory/file.js`)
```

# writeDirectory

_writeDirectory_ is an async function creating a directory on the filesystem. _writeDirectory_ is equivalent to [fs.promises.mkdir](https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_fspromises_mkdir_path_options) but accepts url strings as directory path.

```js
import { writeDirectory } from "@jsenv/filesystem"

await writeDirectory(`file:///directory`)
```

# fileSystemPathToUrl

_fileSystemPathToUrl_ is a function returning a filesystem path from an url string. _fileSystemPathToUrl_ is equivalent to [pathToFileURL from Node.js](https://nodejs.org/docs/latest-v13.x/api/url.html#url_url_pathtofileurl_path) but returns string instead of url objects.

```js
import { fileSystemPathToUrl } from "@jsenv/filesystem"

fileSystemPathToUrl("/directory/file.js")
```

# getRealFileSystemUrlSync

_getRealFileSystemUrlSync_ returns the real url of a file on the filesystem. It takes into account case and symlink.

_Example where "file.js" is actually "FiLe.JS" on filesystem:_

```js
import { getRealFileSystemUrlSync } from "@jsenv/filesystem"

const fileUrl = "file:///dir/file.js"
const realFileUrl = getRealFileSystemUrlSync(fileUrl)
realFileUrl // "file:///dir/FiLe.JS"
```

_Example where "FiLe.JS" is actually "file.js" on filesystem:_

```js
import { getRealFileSystemUrlSync } from "@jsenv/filesystem"

const fileUrl = "file:///dir/FiLe.JS"
const realFileUrl = getRealFileSystemUrlSync(fileUrl)
realFileUrl // "file:///dir/file.js"
```

# isFileSystemPath

_isFileSystemPath_ is a function receiving a string and returning a boolean indicating if this string is a filesystem path.

```js
import { isFileSystemPath } from "@jsenv/filesystem"

isFileSystemPath("/directory/file.js") // true
isFileSystemPath("C:\\directory\\file.js") // true
isFileSystemPath("directory/file.js") // false
isFileSystemPath("file:///directory/file.js") // false
```

# moveEntry

_moveEntry_ is an async function moving a filesystem node to a destination.

```js
import { moveEntry } from "@jsenv/filesystem"

await moveEntry({
  from: "file:///file.js",
  to: "file:///destination/file.js",
})
await moveEntry({
  from: "file:///directory",
  to: "file:///destination/directory",
})
```

# readDirectory

_readDirectory_ is an async function returning an array of string representing all filesystem nodes inside that directory.

```js
import { readDirectory } from "@jsenv/filesystem"

const content = await readDirectory("file:///directory")
```

# readEntryModificationTime

_readEntryModificationTime_ is an async function returning a number of milliseconds representing the date when the file was modified.

```js
import { readEntryModificationTime } from "@jsenv/filesystem"

const mtimeMs = await readEntryModificationTime("file:///directory/file.js")
```

# readFile

_readFile_ is an async function returning the content of a file as string, buffer, or json.

```js
import { readFile } from "@jsenv/filesystem"

const fileContentAsBuffer = await readFile("file:///directory/file.json")
const fileContentAsString = await readFile("file:///directory/file.json", {
  as: "string",
})
const fileContentAsJSON = await readFile("file:///directory/file.json", {
  as: "json",
})
```

# readEntryStat

_readEntryStat_ is an async function returning a filesystem node stats object. _readEntryStat_ is equivalent to [fs.promises.stats from Node.js](https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_fspromises_stat_path_options) but accepts url strings as file path.

```js
import { readEntryStat } from "@jsenv/filesystem"

const stats = await readEntryStat("file:///directory/file.js")
```

# readSymbolicLink

_readSymbolicLink_ is an async function returning a symbolic link target as url string.

```js
import { readSymbolicLink } from "@jsenv/filesystem"

const targetUrlOrRelativeUrl = await readSymbolicLink("file:///directory/link")
```

# registerDirectoryLifecycle

_registerDirectoryLifecycle_ is a function watching a directory at a given path and calling _added_, _updated_, _removed_ according to what is happening inside that directory. Usually, filesystem takes less than 100ms to notify something has changed.

```js
import { registerDirectoryLifecycle } from "@jsenv/filesystem"

const contentMap = {}
const unregister = registerDirectoryLifecycle("file:///directory", {
  added: ({ relativeUrl, type }) => {
    contentMap[relativeUrl] = type
  },
  removed: ({ relativeUrl }) => {
    delete contentMap[relativeUrl]
  },
})

// you can call unregister when you want to stop watching the directory
unregister()
```

# registerFileLifecycle

_registerFileLifecycle_ is a function watching a file and calling _added_, _updated_, _removed_ according to what is happening to that file. Usually, filesystem takes less than 100ms to notify something has changed.

```js
import { readFileSync } from "nod:fs"
import { registerFileLifecycle } from "@jsenv/filesystem"

const filePath = "/file.config.json"
let currentConfig = null
const unregister = registerFileLifecycle(filePath, {
  added: () => {
    currentConfig = JSON.parse(String(readFileSync(filePath)))
  },
  updated: () => {
    currentConfig = JSON.parse(String(readFileSync(filePath)))
  },
  removed: () => {
    currentConfig = null
  },
  notifyExistent: true,
})

// you can call unregister() when you want to stop watching the file
unregister()
```

# removeEntry

_removeEntry_ is an async function removing a node (directory, file, symbolic link) from the filesystem.

```js
import { removeEntry } from "@jsenv/filesystem"

await removeEntry("file:///file.js")
await removeEntry("file:///directory")
```

# resolveUrl

_resolveUrl_ is a function receiving two arguments called _specifier_ and _baseUrl_. Both arguments are **required**. _resolveUrl_ applies url resolution between _specifier_ and _baseUrl_ and returns the corresponding absolute url string.

```js
import { resolveUrl } from "@jsenv/filesystem"

resolveUrl("file.js", "file:///directory/") // file:///directory/file.js
```

## Note about url resolution and directory

When working with directory urls, it is important to have a trailing `/`.

```js
new URL("foo.js", "file:///dir").href // file:///foo.js
new URL("foo.js", `file:///dir/`).href // file:///dir/foo.js
```

For this reason, if you have a variable holding a directory url, be sure to put a trailing slash.

```js
import { resolveUrl } from "@jsenv/filesystem"

const directoryUrl = resolveUrl("./dir/", "file:///")
```

## Difference between resolveUrl and URL

Using _resolveUrl_ means code wants to perform url resolution between something that can be relative: _specifier_ and something absolute: _baseUrl_.

For this reason _resolveUrl_ will throw if _baseUrl_ is `undefined`. This is a major difference with `URL` constructor that would not throw in such case.

```js
import { resolveUrl } from "@jsenv/filesystem"

new URL("http://example.com", undefined) // does not throw

resolveUrl("http://example.com", undefined) // throw "baseUrl is missing to resolve http://example.com"
```

Technically, `http://example.com` is already absolute and does not need a _baseUrl_ to be resolved. But, receiving `undefined` when an absolute url was expected indicates there is something wrong in the code.

This is a feature that helps to catch bugs.

# urlIsInsideOf

_urlIsInsideOf_ is a function returning a boolean indicating if an url is inside an other url.

```js
import { urlIsInsideOf } from "@jsenv/filesystem"

urlIsInsideOf("file:///directory/file.js", "file:///directory/") // true
urlIsInsideOf("file:///file.js", "file:///directory/") // false
```

# urlToBasename

_urlToBasename_ is receiving an url and returning its basename.

```js
import { urlToBasename } from "@jsenv/filesystem"

urlToBasename("file:///directory/file.js") // "file"
urlToBasename("file:///directory/") // "directory"
urlToBasename("http://example.com") // ""
```

# urlToExtension

_urlToExtension_ is receiving an url and returning its extension.

```js
import { urlToExtension } from "@jsenv/filesystem"

urlToExtension("file:///directory/file.js") // ".js"
urlToExtension("file:///directory/file.") // "."
urlToExtension("http://example.com/file") // ""
```

# urlToFilename

_urlToFilename_ is receiving an url and returning its filename.

```js
import { urlToFilename } from "@jsenv/filesystem"

urlToFilename("file:///directory/file.js") // "file.js"
urlToFilename("file:///directory/file.") // "file."
urlToFilename("http://example.com/file") // "file"
```

# urlToFileSystemPath

_urlToFileSystemPath_ is a function returning a filesystem path from an url. _urlToFileSystemPath_ is equivalent to [pathToFileURL from Node.js](https://nodejs.org/docs/latest-v13.x/api/url.html#url_url_pathtofileurl_path) but returns string instead of url objects.

```js
import { urlToFileSystemPath } from "@jsenv/filesystem"

// on mac or linux
urlToFileSystemPath("file:///directory/file.js") // /directory/file.js

// on windows
urlToFileSystemPath("file://C:/directory/file.js") // C:\\directory\\file.js
```

# urlToOrigin

_urlToOrigin_ is a function receiving an url and returning its origin.

```js
import { urlToOrigin } from "@jsenv/filesystem"

urlToOrigin("file:///directory/file.js") // "file://"
urlToOrigin("http://example.com/file.js") // "http://example.com"
```

# urlToParentUrl

_urlToParentUrl_ is a function receiving an url and returning its parent url if any or the url itself.

```js
import { urlToParentUrl } from "@jsenv/filesystem"

urlToParentUrl("http://example.com/dir/file.js") // "http://example.com/dir/"
urlToParentUrl("http://example.com/dir/") // "http://example.com/"
urlToParentUrl("http://example.com/") // "http://example.com/"
```

# urlToPathname

_urlToPathname_ is a function receiving an url and returning its pathname.

```js
import { urlToPathname } from "@jsenv/filesystem"

urlToPathname("http://example.com/dir/file.js") // "/dir/file.js"
urlToPathname("http://example.com/dir/") // "/dir/"
urlToPathname("http://example.com/") // "/"
```

# urlToRelativeUrl

_urlToRelativeUrl_ is a function receiving two absolute urls and returning the first url relative to the second one. _urlToRelativeUrl_ is the url equivalent to [path.relative from Node.js](https://nodejs.org/docs/latest-v13.x/api/path.html#path_path_relative_from_to).

```js
import { urlToRelativeUrl } from "@jsenv/filesystem"

urlToRelativeUrl("file:///directory/file.js", "file:///directory/") // file.js
urlToRelativeUrl("file:///directory/index.js", "file:///directory/foo/file.js") // ../index.js
```

# urlToRessource

_urlToRessource_ is a function receiving an url and returning its ressource.

```js
import { urlToRessource } from "@jsenv/filesystem"

urlToRessource("http://example.com/dir/file.js?foo=bar#10") // "/dir/file.js?foo=bar#10"
```

# urlToScheme

_urlToScheme_ is a function receiving an url and returning its scheme.

```js
import { urlToScheme } from "@jsenv/filesystem"

urlToScheme("http://example.com") // "http"
urlToScheme("file:///dir/file.js") // "file"
urlToScheme("about:blank") // "about"
```

# writeFile

_writeFile_ is an async function writing file and its content on the filesystem. This function auto create file parent directories if they do not exists.

```js
import { writeFile } from "@jsenv/filesystem"

await writeFile("file:///directory/file.txt", "Hello world")
```

# writeEntryModificationTime

_writeEntryModificationTime_ is an async function writing file and its content on the filesystem. _writeEntryModificationTime_ is like [fs.promises.utimes](https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_fspromises_utimes_path_atime_mtime) but accepts url strings as file path.

```js
import { writeEntryModificationTime } from "@jsenv/filesystem"

await writeEntryModificationTime("file:///directory/file.js", Date.now())
```

# writeSymbolicLink

_writeSymbolicLink_ is an async function writing a symlink link to a file or directory on the filesystem.

```js
import { writeSymbolicLink } from "@jsenv/filesystem"

await writeSymbolicLink({
  from: "file:///foo.js",
  to: "./bar.js",
  allowUseless: false,
  allowOverwrite: false,
})
```

# Advanced API

There is a few more functions but they are more specific, you probably don't need them: [Advanced API](./API_advanced.md)
