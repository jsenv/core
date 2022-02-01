import { readFile, writeFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { transformJs } from "@jsenv/core/src/internal/compile_server/js/js_transformer.js"
import { TRANSFORM_JS_TEST_PARAMS } from "../TEST_PARAMS_TRANSFORM_JS.js"

const fileUrl = new URL(`./import_meta.js`, import.meta.url)
const fileDistUrl = new URL("./dist/import_meta.js", import.meta.url)
const originalFileContent = await readFile(fileUrl)
const test = async (params) => {
  const { code } = await transformJs({
    ...TRANSFORM_JS_TEST_PARAMS,
    code: originalFileContent,
    url: String(fileUrl),
    ...params,
  })
  await writeFile(fileDistUrl, code)
}

// esmodule
{
  await test({
    moduleOutFormat: "esmodule",
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
      url: String(fileDistUrl),
      hot,
    }),
    url: String(fileDistUrl),
    urlDestructured: String(fileDistUrl),
    typeOfImportMetaDev: "undefined",
    importMetaHot: hot,
  }
  assert({ actual, expected })
}

// systemjs
// {
//   await test({
//     moduleOutFormat: "systemjs",
//   })
//   await import("systemjs/dist/system-node.cjs")
//   const { meta, url, urlDestructured, typeOfImportMetaDev } =
//     await global.System.import("./dist/import_meta.js", import.meta.url)
//   const actual = {
//     meta,
//     url,
//     urlDestructured,
//     typeOfImportMetaDev,
//   }
//   const expected = {
//     meta: {
//       url: String(fileDistUrl),
//       resolve: assert.any(Function),
//     },
//     url: String(fileDistUrl),
//     urlDestructured: String(fileDistUrl),
//     typeOfImportMetaDev: "undefined",
//   }
//   assert({ actual, expected })
// }

// // global
// {
//   await test({
//     moduleOutFormat: "global",
//   })
//   const { meta, url, urlDestructured, typeOfImportMetaDev } = await import(
//     fileDistUrl
//   )
//   const actual = {
//     meta,
//     url,
//     urlDestructured,
//     typeOfImportMetaDev,
//   }
//   const expected = {
//     meta: assert.asObjectWithoutPrototype({
//       resolve: assert.any(Function),
//       url: String(fileDistUrl),
//     }),
//     url: String(fileDistUrl),
//     urlDestructured: String(fileDistUrl),
//     typeOfImportMetaDev: "undefined",
//   }
//   assert({ actual, expected })
// }
