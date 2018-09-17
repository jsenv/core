// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

/* eslint-disable import/max-dependencies */
import { URL } from "url"
import { createCompile } from "../createCompile/createCompile.js"
import { createCompileService } from "../createCompileService/index.js"
import { createFileService } from "../createFileService/index.js"
import { createResponseGenerator } from "../openServer/createResponseGenerator.js"
import { enableCORS } from "../openServer/createNodeRequestHandler.js"
import { openServer } from "../openServer/openServer.js"

const guard = (fn, shield) => (...args) => {
  return shield(...args) ? fn(...args) : undefined
}

export const openCompileServer = ({
  // server options
  url,
  autoCloseOnExit,
  autoCloseOnCrash,
  autoCloseOnError,
  // compile options
  rootLocation,
  cacheFolderRelativeLocation = "build",
  abstractFolderRelativeLocation = "compiled",
  cors = true,
  transpile = true,
  sourceMap = "comment", // can be "comment", "inline", "none"
  sourceURL = true,
  minify = false,
  optimize = false,
  instrument = false,
}) => {
  const compile = createCompile({
    createOptions: () => {
      // we should use a token or something to prevent a browser from being taken for nodejs
      // because will have security impact as we are going to trust this
      // const isNodeClient =
      //   request.headers.has("user-agent") &&
      //   request.headers.get("user-agent").startsWith("node-fetch")

      const remap = sourceMap === "comment" || sourceMap === "inline"
      const remapMethod = sourceMap

      const identify = sourceURL
      const identifyMethod = "relative"

      return {
        identify,
        identifyMethod,
        transpile,
        instrument,
        remap,
        remapMethod,
        minify,
        optimize,
      }
    },
  })

  return openServer({
    url,
    autoCloseOnExit,
    autoCloseOnCrash,
    autoCloseOnError,
  }).then(({ url, addRequestHandler, close }) => {
    const { service: compileService, compileFile } = createCompileService({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      trackHit: true,
      compile,
    })

    const fileService = createFileService()

    const handler = createResponseGenerator({
      services: [
        guard(compileService, ({ method, url }) => {
          if (method !== "GET" && method !== "HEAD") {
            return false
          }

          const pathname = url.pathname
          // '/compiled/folder/file.js' -> 'compiled/folder/file.js'
          const filename = pathname.slice(1)
          const dirname = filename.slice(0, filename.indexOf("/"))

          if (dirname !== abstractFolderRelativeLocation) {
            return false
          }

          return true
        }),
        ({ url, ...props }) => {
          return fileService({
            url: new URL(url.pathname.slice(1), `file:///${rootLocation}/`),
            ...props,
          })
        },
      ],
    })

    addRequestHandler(handler, (response) => (cors ? enableCORS(response) : response))

    return {
      close,
      url,
      rootLocation,
      abstractFolderRelativeLocation,
      compileFile,
    }
  })
}

// if we want to use react we must start a compileServer like that
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

// in order to support a build specific to a given browser we could
/*
startCompileServer({
	createOptions: ({ request }) => {
		// we could run something client side to decide which
		// profile the client belongs to between a,b,c and send it by cookie or header
		// or decide this using user-agent
		const profile = request.headers.get('x-client-feature-profile')
		return {
			profile
		}
	},
	transformer: (result, options, context) => {
		if (options.profile === 'c') {
			return transformFewThings(result, options, context)
		}
		if (options.profile === 'b') {
			return transformSomeThings(result, options, context)
		}
		return transformAllThings(result, options, context)
	}
})
*/

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
