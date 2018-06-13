// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { createResponseGenerator } from "../startServer/createResponseGenerator.js"
import { createNodeRequestHandler, enableCORS } from "../startServer/createNodeRequestHandler.js"
import { startServer } from "../startServer/startServer.js"
import { createFileService } from "../createFileService/index.js"
import { URL } from "url"
import path from "path"
import { createCompileService } from "../createCompileService/index.js"

import { transform } from "babel-core"
import { passed } from "@dmail/action"
import { createOptions } from "./createOptions.js"

const writeSourceLocation = ({ code, location }) => {
  return `${code}
//# sourceURL=${location}`
}

const writeSourceMapLocation = ({ code, location }) => {
  return `${code}
//# sourceMappingURL=${location}`
}

const compiledFolderRelativeLocation = "compiled"
const cacheFolderRelativeLocation = "build"

const createCompiler = (
  { rootLocation, transformOptions, sourceMap, minify, instrument, optimize } = {},
) => {
  const compile = ({ input, inputRelativeLocation, outputRelativeLocation }) => {
    const context = { input, inputRelativeLocation }
    const options = transformOptions(createOptions({ minify }, context), context)
    const { code, ast, map } = transform(input, options)

    return passed({
      code,
      ast,
      map,
    })
      .then(({ code, map }) => {
        // this is here we should do instrumentation with instanbul
        return { code, map }
      })
      .then(({ code, map }) => {
        let output = code
        const outputAssets = []

        const appendSourceURL = Boolean(inputRelativeLocation)

        // sourceURL
        // if sourceMap are put as comment do not put sourceURL
        // because it prevent chrome from fetching sourceMappingURL for some reason breaking sourcemaps
        if (appendSourceURL && sourceMap !== "comment") {
          // client thinks we are at compiled/folder/file.js
          const clientLocation = path.resolve(
            rootLocation,
            `${compiledFolderRelativeLocation}/${inputRelativeLocation}`,
          )
          // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
          const serverLocation = path.resolve(rootLocation, outputRelativeLocation)
          // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js
          const relativeLocation = path.relative(clientLocation, serverLocation)

          output = writeSourceLocation({ code: output, location: relativeLocation })
        }

        // sourceMap
        if (typeof map === "object") {
          // delete sourceMap.sourcesContent
          // we could remove sources content, they can be fetched from server
          // removing them will decrease size of sourceMap BUT force
          // the client to fetch the source resulting in an additional http request

          // we could delete map.sourceRoot to ensure clientLocation is absolute
          // but it's not set anyway because not passed to babel during compilation

          if (sourceMap === "inline") {
            const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
            output = writeSourceMapLocation({
              code: output,
              location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
            })
          } else if (sourceMap === "comment") {
            // folder/file.js -> file.js.map
            const sourceMapName = `${path.basename(inputRelativeLocation)}.map`

            // client thinks we are at compiled/folder/file.js
            const clientLocation = path.resolve(
              rootLocation,
              `${compiledFolderRelativeLocation}/${inputRelativeLocation}.map`,
            )
            // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
            const serverLocation = `${path.resolve(rootLocation, outputRelativeLocation)}.map`
            // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js.map
            const relativeLocation = path.relative(clientLocation, serverLocation)

            output = writeSourceMapLocation({ code: output, location: relativeLocation })

            outputAssets.push({
              name: sourceMapName,
              content: JSON.stringify(map),
            })
          }
        }

        return {
          output,
          outputAssets,
        }
      })
  }

  // we expose compile meta which are used
  // to differentiate different version of the same file
  // depending with which meta it has been compiled
  const meta = {
    sourceMap,
    minified: minify,
    instrumented: instrument,
    optimized: optimize,
  }

  return { compile, meta }
}

export const startCompileServer = ({
  url,
  rootLocation,
  cors = true,
  sourceMap = "comment", // "inline", "comment", "none"
  minify = false,
  instrument = false, // must have, to be implemented
  optimize = false, // nice to have, to implement https://prepack.io/getting-started.html#options
  transformOptions = (options) => options,
}) => {
  const { compile, meta } = createCompiler({
    rootLocation,
    sourceMap,
    minify,
    instrument,
    optimize,
    transformOptions,
  })

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
// the problem with this: the transformOptions is wide open so you can completely change
// babel output but our cache only checks { minified, optimized, intrumented, sourceMap }
// in fact transformOptions must return same options for a given context
// note that minify could use this instead of being part of dmail/shared-config
// also note that we assume we use babel all over the place
// but there is competitor we may want to allow other compiler
// such as typscript, jsx, etc
/*
startCompileServer({
	transformOptions = (options, context) => {
		const { inputRelativeLocation } = context
		if (inputRelativeLocation.endsWith('.jsx')) {
			return {
				...options,
				plugins: [
					['babel-plugin-syntax-jsx', {}],
					['babel-plugin-transform-react-jsx', { "pragma": "React.createElement" }],
					...options.plugins
				],
			}
		]
		return options
	}
})
*/

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
