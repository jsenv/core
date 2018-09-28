// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { URL } from "url"
import { createCompile } from "../createCompile/createCompile.js"
import { createCompileService } from "../createCompileService/index.js"
import { createFileService } from "../createFileService/index.js"
import { createResponseGenerator } from "../openServer/createResponseGenerator.js"
import { enableCORS } from "../openServer/createNodeRequestHandler.js"
import { openServer } from "../openServer/openServer.js"
import { createSSERoom } from "./createSSERoom.js"
import { watchFile } from "../watchFile.js"
import { createRoot } from "@dmail/project-structure"

const guard = (fn, shield) => (...args) => {
  return shield(...args) ? fn(...args) : undefined
}

const getRequiredHelper = ({ rootLocation, instrument }) => {
  if (instrument) {
    return createRoot({
      root: rootLocation,
    }).then(({ getMetaForLocation }) => {
      const instrumentPredicate = ({ inputRelativeLocation }) => {
        return Boolean(getMetaForLocation(inputRelativeLocation).cover)
      }

      return { instrumentPredicate }
    })
  }
  return Promise.resolve({})
}

export const openCompileServer = ({
  // server options
  url,
  autoCloseOnExit,
  autoCloseOnCrash,
  autoCloseOnError,
  watch = false,
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
  return Promise.all([
    getRequiredHelper({ rootLocation, instrument }),
    openServer({
      url,
      autoCloseOnExit,
      autoCloseOnCrash,
      autoCloseOnError,
    }),
  ])
    .then(([helper, server]) => {
      return {
        server,
        ...helper,
      }
    })
    .then(({ server, instrumentPredicate }) => {
      const createWatchServices = () => {
        // https://github.com/dmail-old/http-eventsource/tree/master/lib

        const fileChangedSSE = createSSERoom()
        fileChangedSSE.open()
        const watchedFiles = new Map()
        server.closed.listenOnce(() => {
          watchedFiles.forEach((closeWatcher) => closeWatcher())
          watchedFiles.clear()
          fileChangedSSE.close()
        })
        const watchPredicate = (relativeFilename) => {
          // for now watch only js files (0 not favicon or .map files)
          return relativeFilename.endsWith(".js")
        }

        return [
          ({ headers }) => {
            if (headers.get("accept") === "text/event-stream") {
              return fileChangedSSE.connect(headers.get("last-event-id"))
            }
            return null
          },
          ({ url }) => {
            let relativeFilename = url.pathname.slice(1)
            const dirname = relativeFilename.slice(0, relativeFilename.indexOf("/"))
            if (dirname === abstractFolderRelativeLocation) {
              // when I ask for a compiled file, watch the corresponding file on filesystem
              relativeFilename = relativeFilename.slice(abstractFolderRelativeLocation.length + 1)
            }

            const filename = `${rootLocation}/${relativeFilename}`

            if (watchedFiles.has(filename) === false && watchPredicate(relativeFilename)) {
              const fileWatcher = watchFile(filename, () => {
                fileChangedSSE.sendEvent({
                  type: "file-changed",
                  data: relativeFilename,
                })
              })
              watchedFiles.set(url, fileWatcher)
            }
          },
        ]
      }

      let compileFileFromCompileService
      const createCompileServiceCustom = () => {
        const compile = createCompile({
          instrumentPredicate,
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
        const { service: compileService, compileFile } = createCompileService({
          rootLocation,
          cacheFolderRelativeLocation,
          abstractFolderRelativeLocation,
          trackHit: true,
          compile,
        })
        compileFileFromCompileService = compileFile

        return guard(compileService, ({ method, url }) => {
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
        })
      }

      const createFileServiceCustom = () => {
        const fileService = createFileService()
        const previousFileService = fileService
        return ({ url, ...props }) => {
          const fileURL = new URL(url.pathname.slice(1), `file:///${rootLocation}/`)

          return previousFileService({
            url: fileURL,
            ...props,
          })
        }
      }

      const handler = createResponseGenerator({
        services: [
          ...(watch ? createWatchServices() : []),
          createCompileServiceCustom(),
          createFileServiceCustom(),
        ],
      })

      server.addRequestHandler(handler, (response) => (cors ? enableCORS(response) : response))

      return {
        ...server,
        compileURL: `${server.url}${abstractFolderRelativeLocation}`,
        rootLocation,
        abstractFolderRelativeLocation,
        compileFile: compileFileFromCompileService,
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
