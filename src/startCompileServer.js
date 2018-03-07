import { createResponseGenerator } from "./startServer/createResponseGenerator.js"
import { createNodeRequestHandler, enableCORS } from "./startServer/createNodeRequestHandler.js"
import { startServer } from "./startServer/startServer.js"
import {
	convertFileSystemErrorToResponseProperties,
	createFileService,
} from "./startServer/createFileService.js"
import { createCompiler } from "./compiler/createCompiler.js"
import { readFileAsString } from "./readFileAsString.js"
import { passed, createAction } from "@dmail/action"
import { URL } from "url"
import resolveNodeModule from "resolve"
// import path from "path"

const createCompileService = ({ include = () => true, locate, fetch, transform } = {}) => {
	return ({ method, url }) => {
		if (!include(url)) {
			return
		}

		if (method !== "GET" && method !== "HEAD") {
			return {
				status: 501,
			}
		}

		const inputCodeRelativeLocation = url.pathname.slice(1)

		return passed(locate(inputCodeRelativeLocation)).then((inputCodeLocation) => {
			return passed(fetch(inputCodeLocation)).then((inputCode) => {
				return passed(transform({ inputCode, inputCodeRelativeLocation })).then(
					({ outputCode, ensureOnFileSystem }) => {
						return ensureOnFileSystem().then(() => {
							return {
								status: 200,
								headers: {
									"content-length": Buffer.byteLength(outputCode),
									"cache-control": "no-cache",
								},
								body: outputCode,
							}
						})
					},
				)
			})
		})
	}
}

const createDefaultFileService = ({ defaultFile }) => {
	return ({ url }) => {
		const relativeLocation = url.pathname.slice(1)
		if (relativeLocation.length === 0) {
			url.pathname = defaultFile
		}
	}
}

export const startCompileServer = ({ url, location, cors = true }) => {
	const compiler = createCompiler()
	const outputFolderRelativeLocation = "build/transpiled"

	const handler = createResponseGenerator({
		services: [
			createDefaultFileService({ defaultFile: "index.js" }),
			createFileService({
				include: ({ pathname }) => pathname.startsWith(`/${outputFolderRelativeLocation}/`),
				locate: ({ url }) => {
					const fileURL = new URL(url.pathname.slice(1), `file:///${location}/`)
					return fileURL
				},
			}),
			createCompileService({
				include: () => true,
				locate: (relativeLocation) => {
					const locateNodeModule = ({ location, relativeLocation }) => {
						const action = createAction()

						// console.log("resolve node module", relativeLocation, "from", location)
						resolveNodeModule(relativeLocation, { basedir: location }, (error, moduleLocation) => {
							if (error) {
								if (error.code === "MODULE_NOT_FOUND") {
									// console.log("no module found")
									return action.fail({ status: 404 })
								}
								throw error
							} else {
								// console.log("module found at", moduleLocation)
								action.pass(moduleLocation)
							}
						})

						return action
					}

					const getNodeDependentAndRelativeDependency = (location) => {
						// "node_modules/aaa/main.js"
						// returns { dependent: "": relativeDependency: "aaa/main.js"}

						// "node_modules/bbb/node_modules/aaa/index.js"
						// returns { dependent: "node_modules/bbb", relativeDependency: "aaa/index.js"}

						const prefixedLocation = location[0] === "/" ? location : `/${location}`
						const pattern = "/node_modules/"
						const lastNodeModulesIndex = prefixedLocation.lastIndexOf(pattern)

						if (lastNodeModulesIndex === 0) {
							const dependent = ""
							const relativeDependency = location.slice(pattern.length - 1)
							// console.log("node location", location, "means", { dependent, relativeDependency })
							return {
								dependent,
								relativeDependency,
							}
						}

						const dependent = location.slice(0, lastNodeModulesIndex - 1)
						const relativeDependency = location.slice(lastNodeModulesIndex + pattern.length - 1)
						// console.log("node location", location, "means", { dependent, relativeDependency })
						return {
							dependent,
							relativeDependency,
						}
					}

					if (relativeLocation.startsWith("node_modules/")) {
						const { dependent, relativeDependency } = getNodeDependentAndRelativeDependency(
							relativeLocation,
						)

						let nodeLocation = location
						if (dependent) {
							nodeLocation += `/${dependent}`
						}
						nodeLocation += `/node_modules`

						return locateNodeModule({
							location: nodeLocation,
							relativeLocation: relativeDependency,
						})
					}

					return compiler.locateFile({
						location,
						relativeLocation,
					})
				},
				fetch: (location) => {
					return readFileAsString({
						location,
						errorMapper: convertFileSystemErrorToResponseProperties,
					})
				},
				transform: ({ inputCode, inputCodeRelativeLocation }) => {
					return compiler.compile({
						location,
						inputCode,
						inputCodeRelativeLocation,
						outputFolderRelativeLocation,
					})
				},
			}),
		],
	})

	return startServer({ url }).then(({ url, addRequestHandler, close }) => {
		const nodeRequestHandler = createNodeRequestHandler({
			handler,
			url,
			transform: (response) => {
				if (cors) {
					enableCORS(response.headers)
				}
				return response
			},
		})
		addRequestHandler(nodeRequestHandler)
		return { close, url }
	})
}

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
