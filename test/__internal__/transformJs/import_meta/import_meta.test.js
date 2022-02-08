import { readFile, urlToFileSystemPath, writeFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { transformWithBabel } from "@jsenv/core/src/internal/transform_js/transform_with_babel.js"
import { TRANSFORM_JS_TEST_PARAMS } from "../TEST_PARAMS_TRANSFORM_JS.js"

const fileUrl = new URL(`./import_meta.js`, import.meta.url).href
const fileDistUrl = new URL("./dist/import_meta.js", import.meta.url).href
const originalFileContent = await readFile(fileUrl)
const test = async (params) => {
  const { content } = await transformWithBabel({
    ...TRANSFORM_JS_TEST_PARAMS,
    url: fileUrl,
    content: originalFileContent,
    ...params,
  })
  await writeFile(fileDistUrl, content)
}

// esmodule
{
  await test({
    importMetaFormat: "esmodule",
    importMetaHot: true,
  })
  const { meta, url, urlDestructured, typeOfImportMetaDev, importMetaHot } =
    await import(fileDistUrl)
  const actual = {
    meta,
    url,
    urlDestructured,
    typeOfImportMetaDev,
    importMetaHot,
  }
  const hot = {
    accept: assert.any(Function),
    dispose: assert.any(Function),
  }
  const expected = {
    // meta contains only url (what is provided by the runtime)
    meta: assert.asObjectWithoutPrototype({
      resolve: assert.any(Function),
      url: fileDistUrl,
      hot,
    }),
    url: fileDistUrl,
    urlDestructured: fileDistUrl,
    typeOfImportMetaDev: "undefined",
    importMetaHot: hot,
  }
  assert({ actual, expected })
}

// systemjs
{
  await test({
    moduleOutFormat: "systemjs",
    importMetaFormat: "systemjs",
    importMetaHot: true,
  })
  await import("systemjs/dist/system-node.cjs")
  const { meta, url, urlDestructured, typeOfImportMetaDev, importMetaHot } =
    await global.System.import("./dist/import_meta.js", import.meta.url)
  const actual = {
    meta,
    url,
    urlDestructured,
    typeOfImportMetaDev,
    importMetaHot,
  }
  const expected = {
    meta: {
      url: fileDistUrl,
      resolve: assert.any(Function),
    },
    url: fileDistUrl,
    urlDestructured: fileDistUrl,
    typeOfImportMetaDev: "undefined",
    importMetaHot: undefined,
  }
  assert({ actual, expected })
}

// commonjs
{
  await test({
    importMetaFormat: "commonjs",
    importMetaHot: true,
  })
  global.__filename = urlToFileSystemPath(fileDistUrl)
  const { meta, url, urlDestructured, typeOfImportMetaDev, importMetaHot } =
    await import(`${fileDistUrl}?t=1`)
  const actual = {
    meta,
    url,
    urlDestructured,
    typeOfImportMetaDev,
    importMetaHot,
  }
  const expected = {
    meta: assert.asObjectWithoutPrototype({
      resolve: assert.any(Function),
      url: `${fileDistUrl}?t=1`,
    }),
    url: fileDistUrl,
    urlDestructured: `${fileDistUrl}?t=1`,
    typeOfImportMetaDev: "undefined",
    importMetaHot: undefined,
  }
  assert({ actual, expected })
}

// global
{
  await test({
    importMetaFormat: "global",
    importMetaHot: true,
  })
  global.document = {
    currentScript: {
      src: fileDistUrl,
    },
  }
  const { meta, url, urlDestructured, typeOfImportMetaDev } = await import(
    `${fileDistUrl}?t=2`
  )
  const actual = {
    meta,
    url,
    urlDestructured,
    typeOfImportMetaDev,
  }
  const expected = {
    meta: assert.asObjectWithoutPrototype({
      resolve: assert.any(Function),
      url: `${fileDistUrl}?t=2`,
    }),
    url: fileDistUrl,
    urlDestructured: `${fileDistUrl}?t=2`,
    typeOfImportMetaDev: "undefined",
  }
  assert({ actual, expected })
}
