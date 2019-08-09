import { hrefToPathname } from "@jsenv/module-resolution"
import {
  pathnameToRelativePathname,
  pathnameIsInside,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { namedValueDescriptionToMetaDescription, pathnameToMeta } from "@dmail/project-structure"
import transformModulesSystemJs from "../babel-plugin-transform-modules-systemjs/index.js"
import { ansiToHTML } from "../ansiToHTML.js"
import { createParseError } from "../compiled-file-service/index.js"

const { transformAsync, transformFromAstAsync } = import.meta.require("@babel/core")
const syntaxDynamicImport = import.meta.require("@babel/plugin-syntax-dynamic-import")
const syntaxImportMeta = import.meta.require("@babel/plugin-syntax-import-meta")

const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta]

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

    const metaDescription = namedValueDescriptionToMetaDescription({
      convert: convertMap,
    })
    const { convert } = pathnameToMeta({ pathname: inputRelativePath, metaDescription })
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

export const jsenvTransform = async ({
  inputCode,
  inputPath,
  inputRelativePath,
  inputAst,
  inputMap,
  babelPluginMap,
  allowTopLevelAwait,
  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
  remap,
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: inputPath,
    filenameRelative: inputRelativePath ? inputRelativePath.slice(1) : undefined,
    inputSourceMap: inputMap,
    configFile: false,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
    sourceFileName: inputRelativePath ? inputRelativePath.slice(1) : undefined,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait,
    },
  }

  const asyncPluginName = findAsyncPluginNameInbabelPluginMap(babelPluginMap)

  if (transformModuleIntoSystemFormat && transformTopLevelAwait && asyncPluginName) {
    const babelPluginArrayWithoutAsync = []
    Object.keys(babelPluginMap).forEach((name) => {
      if (name !== asyncPluginName) {
        babelPluginArrayWithoutAsync.push(babelPluginMap[name])
      }
    })

    // put body inside something like (async () => {})()
    const result = await babelTransform({
      ast: inputAst,
      code: inputCode,
      options: {
        ...options,
        plugins: [
          ...defaultBabelPluginArray,
          ...babelPluginArrayWithoutAsync,
          [transformModulesSystemJs, { topLevelAwait: transformTopLevelAwait }],
        ],
      },
    })

    // we need to retranspile the await keywords now wrapped
    // inside Systemjs function.
    // They are ignored, at least by transform-async-to-promises
    // see https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/26

    const finalResult = await babelTransform({
      // ast: result.ast,
      code: result.code,
      options: {
        ...options,
        // about inputSourceMap see
        // https://github.com/babel/babel/blob/eac4c5bc17133c2857f2c94c1a6a8643e3b547a7/packages/babel-core/src/transformation/file/generate.js#L57
        // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-core/src/transformation/file/merge-map.js#L6s
        inputSourceMap: result.map,
        plugins: [...defaultBabelPluginArray, babelPluginMap[asyncPluginName]],
      },
    })

    return {
      ...result,
      ...finalResult,
      metadata: { ...result.metadata, ...finalResult.metadata },
    }
  }

  const babelPluginArray = [
    ...defaultBabelPluginArray,
    ...Object.keys(babelPluginMap).map((babelPluginName) => babelPluginMap[babelPluginName]),
    ...(transformModuleIntoSystemFormat
      ? [[transformModulesSystemJs, { topLevelAwait: transformTopLevelAwait }]]
      : []),
  ]
  const result = await babelTransform({
    ast: inputAst,
    code: inputCode,
    options: {
      ...options,
      plugins: babelPluginArray,
    },
  })
  return result
}

export const findAsyncPluginNameInbabelPluginMap = (babelPluginMap) => {
  if ("transform-async-to-promises" in babelPluginMap) {
    return "transform-async-to-promises"
  }
  if ("transform-async-to-generator" in babelPluginMap) {
    return "transform-async-to-generator"
  }
  return ""
}

const babelTransform = async ({ ast, code, options }) => {
  try {
    if (ast) {
      return await transformFromAstAsync(ast, code, options)
    }
    return await transformAsync(code, options)
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      const message = error.message
      throw createParseError({
        message,
        messageHTML: ansiToHTML(message),
        filename: options.filename,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column,
      })
    }
    throw error
  }
}
