import transformModulesSystemJs from "../babel-plugin-transform-modules-systemjs/index.js"

const { transformAsync, transformFromAstAsync } = import.meta.require("@babel/core")
const syntaxDynamicImport = import.meta.require("@babel/plugin-syntax-dynamic-import")
const syntaxImportMeta = import.meta.require("@babel/plugin-syntax-import-meta")

const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta]

export const transpiler = async ({
  input,
  filename,
  filenameRelative,
  inputAst,
  inputMap,
  babelPluginMap,
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  remap = true,
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: filename || filenameRelative,
    filenameRelative,
    inputSourceMap: inputMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
    sourceFileName: filenameRelative,
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
    const result = await transpile({
      ast: inputAst,
      code: input,
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

    const finalResult = await transpile({
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
  return transpile({
    ast: inputAst,
    code: input,
    options: {
      ...options,
      plugins: babelPluginArray,
    },
  })
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

const transpile = async ({ ast, code, options }) => {
  if (ast) {
    return await transformFromAstAsync(ast, code, options)
  }
  return await transformAsync(code, options)
}
