// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { createResponseGenerator } from "../startServer/createResponseGenerator.js"
import { createNodeRequestHandler, enableCORS } from "../startServer/createNodeRequestHandler.js"
import { startServer } from "../startServer/startServer.js"
import { createFileService } from "../createFileService/index.js"
import { URL } from "url"
import path from "path"
import { createCompileService } from "../createCompileService/index.js"

import { passed } from "@dmail/action"
import { transform as defaultTransform } from "./transform.js"

import { writeSourceURL, writeSourceMapBase64, writeSourceMapComment } from "./writeSourceInfo.js"

const compiledFolderRelativeLocation = "compiled"
const cacheFolderRelativeLocation = "build"

export const startCompileServer = ({
  url,
  rootLocation,
  cors = true,
  transform = defaultTransform,
  sourceMap = "comment", // "inline", "comment", "none"
  minify = false,
  instrument = false, // must have, to be implemented
  optimize = false, // nice to have, to implement https://prepack.io/getting-started.html#options
}) => {
  // minify should not be passed as an option
  // minify is something we do (when true) after the transform
  // because transform is reponsible to take something and convert it to javascript
  // but is not necessarily babel so we cannot assume transform can/will minify
  // that's something we want to run on transform output
  // in the case where transform is babel or the abstract syntax tree is given to us
  // we'll pass it during minification
  const options = { minify }

  const compile = ({ input, inputRelativeLocation, outputRelativeLocation }) => {
    const context = {
      rootLocation,
      compiledFolderRelativeLocation,
      inputRelativeLocation,
      outputRelativeLocation,
    }

    return passed(transform(input, options, context))
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
          output = writeSourceURL(output, context)
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
            output = writeSourceMapBase64(output, map, context)
          } else if (sourceMap === "comment") {
            // folder/file.js -> file.js.map
            const name = `${path.basename(inputRelativeLocation)}.map`
            output = writeSourceMapComment(output, name, context)

            outputAssets.push({
              name,
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
import { startCompileServer, defaultTransform, createBabelOptions } from "@dmail/dev-server"

startCompileServer({
	transform: (input, options, context) => {
		const { inputRelativeLocation } = context
		if (inputRelativeLocation.endsWith('.jsx')) {
			const babelOptions = createBabelOptions(input, options, context)
			const babelOptionWithReact = {
				...babelOptions,
				plugins: [
					['babel-plugin-syntax-jsx', {}],
					['babel-plugin-transform-react-jsx', { "pragma": "React.createElement" }],
					...babelOptions.plugins
				],
			}
			return babel.transform(input, babelOptionWithReact)
		]
		return defaultTransform(input, options, context)
	}
})

*/

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
