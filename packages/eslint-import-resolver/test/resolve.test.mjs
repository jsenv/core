import { assert } from "@jsenv/assert"
import {
  ensureEmptyDirectory,
  resolveUrl,
  ensureWindowsDriveLetter,
  urlToFileSystemPath,
  writeFile,
} from "@jsenv/filesystem"

import * as resolver from "@jsenv/eslint-import-resolver"

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)

// import starting with /
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl("dir/foo.js", tempDirectoryUrl)
  const resolvedFileUrl = `${tempDirectoryUrl}file.js`
  const actual = resolver.resolve(
    "/file.js",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl: tempDirectoryUrl,
    },
  )
  const expected = {
    found: false,
    path: urlToFileSystemPath(resolvedFileUrl),
  }
  assert({ actual, expected })
}

// import starting with / (node style)
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl("dir/foo.js", tempDirectoryUrl)
  const resolvedFileUrl = ensureWindowsDriveLetter(
    resolveUrl("/file.js", tempDirectoryUrl),
    tempDirectoryUrl,
  )
  const actual = resolver.resolve(
    "/file.js",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl: tempDirectoryUrl,
      packageConditions: ["node", "import"],
    },
  )
  const expected = {
    found: false,
    path: urlToFileSystemPath(resolvedFileUrl),
  }
  assert({ actual, expected })
}

// import containing query param
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl("main.js", tempDirectoryUrl)
  const fileUrl = resolveUrl("./file.js", tempDirectoryUrl)
  await writeFile(fileUrl)
  const actual = resolver.resolve(
    "./file.js?foo=bar",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl: tempDirectoryUrl,
    },
  )
  const expected = {
    found: true,
    path: urlToFileSystemPath(fileUrl),
  }
  assert({ actual, expected })
}

// import 'fs' outside node
{
  const importerFileUrl = resolveUrl("file", tempDirectoryUrl)
  const importerPath = urlToFileSystemPath(importerFileUrl)
  const fileUrl = resolveUrl("./fs", tempDirectoryUrl)

  const actual = resolver.resolve("fs", importerPath, {
    rootDirectoryUrl: tempDirectoryUrl,
    logLevel: "off",
  })
  const expected = {
    found: false,
    path: urlToFileSystemPath(fileUrl),
  }
  assert({ actual, expected })
}

// import 'fs' inside node
{
  const importerFileUrl = resolveUrl("file", tempDirectoryUrl)
  const importerPath = urlToFileSystemPath(importerFileUrl)

  const actual = resolver.resolve("fs", importerPath, {
    rootDirectoryUrl: tempDirectoryUrl,
    packageConditions: ["node", "import"],
  })
  const expected = {
    found: true,
    path: null,
  }
  assert({ actual, expected })
}

// bare specifier not mapped
{
  const importerFileUrl = resolveUrl("file", tempDirectoryUrl)
  const importerPath = urlToFileSystemPath(importerFileUrl)
  const fileUrl = resolveUrl("./foo", tempDirectoryUrl)

  const actual = resolver.resolve("foo", importerPath, {
    rootDirectoryUrl: tempDirectoryUrl,
    logLevel: "off",
  })
  const expected = {
    found: false,
    path: urlToFileSystemPath(fileUrl),
  }
  assert({ actual, expected })
}

// bare specifier remapped
{
  const importerFileUrl = resolveUrl("src/babelTest.js", tempDirectoryUrl)
  const resolvedFileUrl = resolveUrl(
    "node_modules/@babel/plugin-proposal-object-rest-spread/lib/index.js",
    tempDirectoryUrl,
  )
  const importmapFileUrl = resolveUrl("import-map.importmap", tempDirectoryUrl)
  await writeFile(
    importmapFileUrl,
    JSON.stringify({
      imports: {
        "@babel/plugin-proposal-object-rest-spread":
          "./node_modules/@babel/plugin-proposal-object-rest-spread/lib/index.js",
      },
    }),
  )

  const actual = resolver.resolve(
    "@babel/plugin-proposal-object-rest-spread",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl: tempDirectoryUrl,
      importmapFileRelativeUrl: "import-map.importmap",
    },
  )
  const expected = {
    found: false,
    path: urlToFileSystemPath(resolvedFileUrl),
  }
  assert({ actual, expected })
}

// bare specifier remapped by scope
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl(
    "node_modules/use-scoped-foo/index.js",
    tempDirectoryUrl,
  )
  const resolvedFileUrl = resolveUrl(
    "node_modules/use-scoped-foo/node_modules/foo/index.js",
    tempDirectoryUrl,
  )
  const importmapFileUrl = resolveUrl("import-map.importmap", tempDirectoryUrl)
  await writeFile(
    importmapFileUrl,
    JSON.stringify({
      scopes: {
        "./node_modules/use-scoped-foo/": {
          foo: "./node_modules/use-scoped-foo/node_modules/foo/index.js",
        },
      },
    }),
  )

  const actual = resolver.resolve("foo", urlToFileSystemPath(importerFileUrl), {
    rootDirectoryUrl: tempDirectoryUrl,
    importmapFileRelativeUrl: "import-map.importmap",
  })
  const expected = {
    found: false,
    path: urlToFileSystemPath(resolvedFileUrl),
  }
  assert({ actual, expected })
}

// import an http url
{
  const importerFileUrl = resolveUrl("file", tempDirectoryUrl)

  const actual = resolver.resolve(
    "http://domain.com/file.js",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl: tempDirectoryUrl,
    },
  )
  const expected = {
    found: true,
    // it's important to return null here and not the url
    // because eslint-plugin-import will try to read
    // file at this path and fail to do so
    // when it is an url
    path: null,
  }
  assert({ actual, expected })
}

// sibling file from top level project file
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl("project/importer", tempDirectoryUrl)
  const resolvedFileUrl = resolveUrl("project/file", tempDirectoryUrl)
  const rootDirectoryUrl = resolveUrl("project", tempDirectoryUrl)
  await writeFile(importerFileUrl)
  await writeFile(resolvedFileUrl)
  const importerPath = urlToFileSystemPath(importerFileUrl)

  const actual = resolver.resolve("./file", importerPath, {
    rootDirectoryUrl,
  })
  const expected = {
    found: true,
    path: urlToFileSystemPath(resolvedFileUrl),
  }
  assert({ actual, expected })
}

// parent from project directory
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl("project/dir/importer", tempDirectoryUrl)
  const resolvedFileUrl = resolveUrl("project/file", tempDirectoryUrl)
  const rootDirectoryUrl = resolveUrl("project", tempDirectoryUrl)
  await writeFile(importerFileUrl)
  await writeFile(resolvedFileUrl)

  const actual = resolver.resolve(
    "../file",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl,
    },
  )
  const expected = {
    found: true,
    path: urlToFileSystemPath(resolvedFileUrl),
  }
  assert({ actual, expected })
}

// parent from top level project file
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl("project/importer", tempDirectoryUrl)
  const resolvedFileUrl = resolveUrl("file", tempDirectoryUrl)
  const rootDirectoryUrl = resolveUrl("project", tempDirectoryUrl)
  await writeFile(importerFileUrl)
  await writeFile(resolvedFileUrl)

  const actual = resolver.resolve(
    "../file",
    urlToFileSystemPath(importerFileUrl),
    {
      rootDirectoryUrl,
    },
  )
  const expected = {
    found: true,
    path: urlToFileSystemPath(resolvedFileUrl),
  }
  assert({ actual, expected })
}

// an importmap file inside a directory
{
  await ensureEmptyDirectory(tempDirectoryUrl)
  const importerFileUrl = resolveUrl("project/importer", tempDirectoryUrl)
  const resolvedFileUrl = resolveUrl("project/file.js", tempDirectoryUrl)
  const importmapFileRelativeUrl = "project/test.importmap"
  const importmapFileUrl = resolveUrl(
    importmapFileRelativeUrl,
    tempDirectoryUrl,
  )
  await writeFile(
    importmapFileUrl,
    JSON.stringify({
      imports: {
        "./file": "./file.js",
      },
    }),
  )
  await writeFile(resolvedFileUrl)

  const actual = resolver.resolve(
    "./file",
    urlToFileSystemPath(importerFileUrl),
    {
      logLevel: "error",
      rootDirectoryUrl: tempDirectoryUrl,
      importmapFileRelativeUrl,
    },
  )
  const expected = {
    found: true,
    path: urlToFileSystemPath(resolvedFileUrl),
  }
  assert({ actual, expected })
}
