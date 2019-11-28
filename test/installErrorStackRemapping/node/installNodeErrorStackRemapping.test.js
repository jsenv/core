import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { hrefToPathname, pathnameToRelativePath } from "@jsenv/href"
import { resolveImportForProject } from "@jsenv/import-map"
import { installNodeErrorStackRemapping } from "../../index.js"
import { projectPathname } from "../projectPathname.js"

const resolveHref = ({ specifier, importer = import.meta.url }) => {
  if (specifier === projectPathname) {
    specifier = "/"
  } else if (specifier.startsWith(`${projectPathname}/`)) {
    specifier = pathnameToRelativePath(specifier, projectPathname)
  }

  return resolveImportForProject({
    projectPathname,
    specifier,
    importer,
    forceInsideProject: false,
  })
}

const { getErrorOriginalStackString } = installNodeErrorStackRemapping({ resolveHref })

const error = new Error()
const stackString = error.stack
{
  const selfPathname = hrefToPathname(import.meta.url)
  const relativePath = pathnameToRelativePath(selfPathname, projectPathname)
  const compiledPath = pathnameToOperatingSystemPath(`${projectPathname}/.dist/best${relativePath}`)
  const actual = stackString.includes(compiledPath)
  const expected = true
  assert({ actual, expected })
}
const originalStackString = await getErrorOriginalStackString(error)
{
  const actual = originalStackString.includes(import.meta.url)
  const expected = true
  assert({ actual, expected })
}
