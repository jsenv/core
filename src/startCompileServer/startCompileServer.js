// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

/* eslint-disable import/max-dependencies */
import { createResponseGenerator } from "../startServer/createResponseGenerator.js"
import { createNodeRequestHandler, enableCORS } from "../startServer/createNodeRequestHandler.js"
import { startServer } from "../startServer/startServer.js"
import { createFileService } from "../createFileService/index.js"
import { URL } from "url"
import { createCompileService } from "../createCompileService/index.js"

import { passed } from "@dmail/action"
import { transformer as defaultTransformer } from "./transformer.js"
import { minifier as defaultMinifier } from "./minifier.js"
import { instrumenter as defaultInstrumenter } from "./instrumenter.js"
import { optimizer as defaultOptimizer } from "./optimizer.js"
import { identifier } from "./identifier.js"
import { sourceMapper } from "./sourceMapper.js"

const compiledFolderRelativeLocation = "compiled"
const cacheFolderRelativeLocation = "build"

export const startCompileServer = ({
  url,
  rootLocation,
  cors = true,
  transformer = defaultTransformer,
  transform = true,
  minifier = defaultMinifier,
  minify = false,
  instrumenter = defaultInstrumenter,
  instrument = false,
  optimizer = defaultOptimizer,
  optimize = false,
  sourceMap = true,
  sourceMapLocation = "commment", // 'comment' or 'inline'
}) => {
  const options = {
    minify,
    instrument,
    optimize,
    sourceMap,
    sourceMapLocation,
  }

  const compile = (compileContext) => {
    const context = {
      rootLocation,
      compiledFolderRelativeLocation,
      ...compileContext,
    }

    // if sourceMap are appended as comment do not put //#sourceURL=../../file.js
    // because chrome will not work with something like //#sourceMappingURL=../../file.js.map
    // thus breaking sourcemaps
    const identify = context.inputRelativeLocation && sourceMap !== "comment"

    return passed({
      code: context.input,
      ast: null,
      map: null,
    })
      .then((result) => {
        return transform ? transformer(result, options, context) : result
      })
      .then((result) => {
        return instrument ? instrumenter(result, options, context) : result
      })
      .then((result) => {
        return minify ? minifier(result, options, context) : result
      })
      .then((result) => {
        return optimize ? optimizer(result, options, context) : result
      })
      .then((result) => {
        return identify ? identifier(result, options, context) : result
      })
      .then((result) => {
        return sourceMap ? sourceMapper(result, options, context) : result
      })
      .then(({ code, map, mapName }) => {
        if (mapName) {
          return {
            output: code,
            outputAssets: [
              {
                name: mapName,
                content: JSON.stringify(map),
              },
            ],
          }
        }
        return {
          output: code,
          outputAssets: [],
        }
      })
  }

  // this is not how it should work:
  // the meta SHOULD AND MUST be aysnchronously returned by the compiler
  // to say that for this given context the compilation will use a given set of options
  // then we check for cache for theses options
  // options becomes dynamic

  // we expose compile meta which are used
  // to differentiate different version of the same file
  // depending with which meta it has been compiled
  const meta = {
    sourceMap,
    minified: minify,
    instrumented: instrument,
    optimized: optimize,
  }

  const compileService = createCompileService({
    compile,
    compileMeta: meta,
    rootLocation,
    cacheFolderRelativeLocation,
    trackHit: true,
  })

  const handler = createResponseGenerator({
    services: [
      (request) => {
        // change pathname from 'compile/folder/file.js' to 'folder/file.js'
        // because only server need a way to differentiate request that needs to be compiled
        // from request that needs to be served as file
        // compileService does not have to know about this
        if (request.url.pathname.startsWith(`/${compiledFolderRelativeLocation}`)) {
          const compileURL = new URL(request.url)
          compileURL.pathname = request.url.pathname.slice(
            `/${compiledFolderRelativeLocation}`.length,
          )
          return compileService({
            ...request,
            url: compileURL,
          })
        }
      },
      createFileService({
        locate: ({ url }) => {
          const pathname = url.pathname.slice(1)
          const resolvedUrl = new URL(pathname, `file:///${rootLocation}/`)
          return resolvedUrl
        },
      }),
    ],
  })

  return startServer({ url }).then(({ url, addRequestHandler, close }) => {
    const nodeRequestHandler = createNodeRequestHandler({
      handler,
      url,
      transform: (response) => (cors ? enableCORS(response) : response),
    })
    addRequestHandler(nodeRequestHandler)

    return { close, url, compileURL: new URL(`${compiledFolderRelativeLocation}/`, url) }
  })
}

// if we want to use react we must start a compileServer like that
// how minified / instrumented version will be linked to their cached version
// will becomes more clear when minify and instrument values will becomes dynamically
// set by something, somewhere
// this day we'll know how to map cache to the minified/instrumented versions of a file
/*
import { startCompileServer, defaultTransformer, createBabelOptions } from "@dmail/dev-server"

startCompileServer({
	transformer: (result, options, context) => {
		const { inputRelativeLocation } = context
		if (inputRelativeLocation.endsWith('.jsx')) {
			const babelOptions = createBabelOptions(result, options, context)
			const babelOptionWithReact = {
				...babelOptions,
				plugins: [
					['babel-plugin-syntax-jsx', {}],
					['babel-plugin-transform-react-jsx', { "pragma": "React.createElement" }],
					...babelOptions.plugins
				],
			}
			return babel.transform(result.code, babelOptionWithReact)
		]
		return defaultTransformer(result, options, context)
	}
})

*/

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
