import { getBabelPluginsFor } from "@dmail/project-structure-compile-babel"
import { transpileWithBabel } from "./transpileWithBabel.js"

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

  const babelOptions = {
    plugins: getBabelPluginsFor({
      // platformName below 'should' be dynamic and read from request user-agent to compile the right output
      // an other problem is that the compile result will become different depending who is requesting it
      // so we must have a smart strategy to cache the output
      // we cannot create a cache entry per user agent, the cache would explode
      // we could keep a cache per plugin set but the array returned by getBabelPluginsFor
      // cannot be stringified for now (it's an array of function)
      // we could also use an other approach 'ala' browser list so that we use browser list to get the list of plugins
      // and use it to invalidate the cache
      // it would be the easisest approach
      // we could maintain 2-3 browserlist to serve depending the user -agent requesting us
      // we would server one of the 3 build
      platformName: "node",
      platformVersion: "5.0",
      moduleOutput: "systemjs",
    }),
    filename: inputRelativeLocation,
    inputSourceMap,
  }

  return transpileWithBabel({
    inputAst,
    inputSource,
    options: babelOptions,
    ...(options.remap
      ? {
          outputSourceMapName,
          sourceLocationForSourceMap: getSourceLocationForSourceMap(context),
          sourceNameForSourceMap: getSourceNameForSourceMap(context),
        }
      : {}),
  })
}
