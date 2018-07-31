// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

/* eslint-disable import/max-dependencies */
import { URL } from "url"
import { createCompile } from "../createCompile/createCompile.js"
import { createCompileService } from "../createCompileService/index.js"
import { createFileService } from "../createFileService/index.js"
import { createNodeRequestHandler, enableCORS } from "../openServer/createNodeRequestHandler.js"
import { createResponseGenerator } from "../openServer/createResponseGenerator.js"
import { openServer } from "../openServer/openServer.js"

const compiledFolderRelativeLocation = "compiled"
const cacheFolderRelativeLocation = "build"

export const openCompileServer = ({
  url,
  rootLocation,
  cors = true,
  sourceMap = "comment", // can be "comment", "inline", "none"
  sourceURL = true,
}) => {
  const compile = createCompile({
    createOptions: ({ request }) => {
      // we should use a token or something to prevent a browser from being taken for nodejs
      // because will have security impact as we are going to trust this
      const isNodeClient =
        request.headers.has("user-agent") &&
        request.headers.get("user-agent").startsWith("node-fetch")

      const remap = sourceMap === "comment" || sourceMap === "inline"
      let remapMethod
      if (sourceMap === "comment") {
        if (isNodeClient) {
          remapMethod = "comment-absolute"
        } else {
          // if a browser or anything else comment-relative
          remapMethod = "comment-relative"
        }
      } else if (sourceMap === "inline") {
        remapMethod = "inline"
      }

      const identify = sourceURL
      let identifyMethod
      if (identify) {
        if (isNodeClient) {
          identifyMethod = "absolute"
        } else {
          identifyMethod = "relative"
        }
      }

      return {
        identify,
        identifyMethod,
        remap,
        remapMethod,
      }
    },
  })

  const compileService = createCompileService({
    rootLocation,
    cacheFolderRelativeLocation,
    compiledFolderRelativeLocation,
    trackHit: true,
    compile,
  })

  const handler = createResponseGenerator({
    services: [
      (request) => {
        // change pathname from 'compile/folder/file.js' to 'folder/file.js'
        // because only server need a way to differentiate request that needs to be compiled
        // from request that needs to be served as file
        // compileService does not have to know about this
        const requestURLPathname = request.url.pathname
        if (requestURLPathname.startsWith(`/${compiledFolderRelativeLocation}`)) {
          const compileURL = new URL(request.url)
          compileURL.pathname = requestURLPathname.slice(
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

  return openServer({ url }).then(({ url, addRequestHandler, close }) => {
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
