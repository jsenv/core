import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer } from "../../../index.js"
import { fetch } from "../fetch.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const compileInto = ".dist"

const compileServer = await startCompileServer({
  projectFolder: testFolder,
  logLevel: "off",
})

await fetch(`${compileServer.origin}/${compileInto}/otherwise/asset.js`)
const response = await fetch(
  `${compileServer.origin}/${compileInto}/otherwise/asset.js__asset__/cache.json`,
)
const body = await response.json()
const actual = {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
  body,
}
const expected = {
  status: 200,
  statusText: "OK",
  headers: {
    ...actual.headers,
    "content-type": ["application/json"],
  },
  body: {
    sourceFilenameRelative: "asset.js",
    contentType: "application/javascript",
    sources: ["/asset.js"],
    sourcesEtag: ['"7c-b5QcrFoIrKrXSr5F415m5RCd6uY"'],
    assets: ["asset.js__asset__/asset.js.map"],
    assetsEtag: ['"d5-Y7nurt+aY3asvGmKjqFg8qU+n2c"'],
    createdMs: actual.body.createdMs,
    lastModifiedMs: actual.body.lastModifiedMs,
  },
}

assert({
  actual,
  expected,
})
