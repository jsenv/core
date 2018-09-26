import { getBabelPluginsFor } from "@dmail/project-structure-compile-babel"
import { transform, transformFromAst } from "@babel/core"

export const transpiler = (context) => {
  const {
    inputRelativeLocation,
    inputSource,
    inputSourceMap,
    inputAst,
    options,
    outputSourceMapName,
    getSourceNameForSourceMap,
    getSourceLocationForSourceMap,
  } = context

  const plugins = getBabelPluginsFor({
    // rename name into platformName, and version into platformVersion in @dmail/project-structure-compile-babel

    // name below 'should' be dynamic and read from request user-agent to compile the right output
    // an other problem is that the compile result will become different depending who is requesting it
    // so we must have a smart start to cache the output
    // we cannot create a cache entry per user agent, the cache would explode
    // we could keep a cache per plugin set but the array returned by getBabelPluginsFor does not allow
    // to stringify the list of plugins
    // we could also use an other approach 'ala' browser list so that we use browser list to get the list of plugins
    // and use it to invalidate the cache
    name: "node",
    version: "5.0",
    moduleOutput: "systemjs",
  })

  const remapOptions = options.remap
    ? {
        sourceMaps: true,
        sourceMapTarget: getSourceNameForSourceMap(context),
        sourceFileName: getSourceLocationForSourceMap(context),
      }
    : {
        sourceMaps: false,
      }

  const babelOptions = {
    plugins,
    filename: inputRelativeLocation,
    inputSourceMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    ...remapOptions,
  }

  if (inputAst) {
    const { code, ast, map } = transformFromAst(inputAst, inputSource, babelOptions)
    return {
      outputSource: code,
      outputSourceMap: map,
      outputAst: ast,
      outputAssets: {
        [outputSourceMapName]: JSON.stringify(map, null, "  "),
      },
    }
  }

  const { code, ast, map } = transform(inputSource, babelOptions)
  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
    outputAssets: {
      [outputSourceMapName]: JSON.stringify(map, null, "  "),
    },
  }
}
