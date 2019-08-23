import { hrefToPathname } from "@jsenv/module-resolution"
import {
  pathnameToRelativePathname,
  pathnameIsInside,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { namedMetaToMetaMap, resolveMetaMapPatterns, urlToMeta } from "@jsenv/url-meta"
import { jsenvTransform } from "../jsenvTransform/jsenvTransform.js"

export const transformSource = async ({
  projectPathname,
  source,
  sourceHref,
  babelPluginMap,
  convertMap = {},
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  remap = true,
}) => {
  let inputCode
  let inputMap
  let inputPath
  let inputRelativePath

  const scenario = computeScenario({ projectPathname, sourceHref })

  // ideally we should check convertMap in any scenario
  // but it means we should renamed @dmail/filesystem-matching into
  // @dmail/url-matching
  // and we would not pass pathname anymore but href instead
  // to do later because @dmail/filesystem-matching is heavily used everywhere
  if (scenario === "remote") {
    inputCode = source
    inputPath = sourceHref
  } else if (scenario === "file") {
    inputCode = source
    inputPath = pathnameToOperatingSystemPath(hrefToPathname(sourceHref))
  } else if (scenario === "project-file") {
    inputCode = source
    const sourcePathname = hrefToPathname(sourceHref)
    inputRelativePath = pathnameToRelativePathname(sourcePathname, projectPathname)
    inputPath = pathnameToOperatingSystemPath(sourcePathname)

    const metaMap = resolveMetaMapPatterns(
      namedMetaToMetaMap({
        convert: convertMap,
      }),
      `file://${projectPathname}`,
    )
    const { convert } = urlToMeta({ url: `file://${sourcePathname}`, metaMap })
    if (convert) {
      if (typeof convert !== "function") {
        throw new TypeError(`convert must be a function, got ${convert}`)
      }
      const conversionResult = await convert({
        source,
        sourceHref,
        remap,
        allowTopLevelAwait,
      })
      if (typeof conversionResult !== "object") {
        throw new TypeError(`convert must return an object, got ${conversionResult}`)
      }
      const code = conversionResult.code
      if (typeof code !== "string") {
        throw new TypeError(`convert must return { code } string, got { code: ${code} } `)
      }

      inputCode = code
      inputMap = conversionResult.map
    }
  }

  return jsenvTransform({
    inputCode,
    inputMap,
    inputPath,
    inputRelativePath,
    babelPluginMap,
    convertMap,
    allowTopLevelAwait,
    transformTopLevelAwait,
    transformModuleIntoSystemFormat,
    remap,
  })
}

const computeScenario = ({ projectPathname, sourceHref }) => {
  if (!sourceHref.startsWith("file:///")) {
    return "remote"
  }

  const sourcePathname = hrefToPathname(sourceHref)

  if (pathnameIsInside(sourcePathname, projectPathname)) {
    return "project-file"
  }

  return "file"
}
