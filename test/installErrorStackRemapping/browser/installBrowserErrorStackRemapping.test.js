import { pathnameToRelativePathname } from "@jsenv/operating-system-path"
import { hrefToPathname, hrefToOrigin } from "@jsenv/href"
import { resolveImportForProject } from "@jsenv/import-map"
import { assert } from "@dmail/assert"
import { installBrowserErrorStackRemapping } from "../../src/installBrowserErrorStackRemapping/installBrowserErrorStackRemapping.js"
import { projectPathname } from "../projectPathname.js"
import { loadUsingScript } from "../loadUsingScript.js"

await loadUsingScript("/node_modules/source-map/dist/source-map.js")
const { SourceMapConsumer } = window.sourceMap
SourceMapConsumer.initialize({
  "lib/mappings.wasm": "/node_modules/source-map/lib/mappings.wasm",
})

const resolveHref = ({ specifier, importer = import.meta.url }) => {
  const resolvedPath = resolveImportForProject({
    projectPathname,
    specifier,
    importer,
    forceInsideProject: false,
  })
  return resolvedPath
}

const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
  resolveHref,
  SourceMapConsumer,
})

const error = new Error()
const stackString = error.stack
{
  const selfOrigin = hrefToOrigin(import.meta.url)
  const selfPathname = hrefToPathname(import.meta.url)
  const relativePathname = pathnameToRelativePathname(selfPathname, projectPathname)
  const compiledHref = `${selfOrigin}${projectPathname}/.dist/best${relativePathname}`
  const actual = stackString.includes(compiledHref)
  const expected = true
  assert({ actual, expected })
}
const originalStackString = await getErrorOriginalStackString(error)
{
  const actual = originalStackString.includes(import.meta.url)
  const expected = true
  assert({ actual, expected })
}
