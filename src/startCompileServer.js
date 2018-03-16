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
import { locateNodeModule } from "./createLoader/createNodeLoader/locateNodeModule.js"
import path from "path"

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

const createIndexService = ({ indexPathname }) => {
	return ({ url }) => {
		// nope bad idea we must send a redirect
		const relativeLocation = url.pathname.slice(1)
		if (relativeLocation.length === 0) {
			url.pathname = indexPathname
		}
	}
}

export const startCompileServer = ({
	url,
	location,
	cors = true,
	indexLocation = "index.html",
}) => {
	const compiler = createCompiler()
	const outputFolderRelativeLocation = "build/transpiled"

	const handler = createResponseGenerator({
		services: [
			createIndexService({ indexPathname: indexLocation }),
			createCompileService({
				include: ({ pathname }) => {
					if (pathname.startsWith(`/${outputFolderRelativeLocation}/`)) {
						return false
					}
					const extname = path.extname(pathname)
					if (extname !== ".js" && extname !== ".mjs") {
						return false
					}
					return true
				},
				locate: (relativeLocation) => {
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

						const action = createAction()
						try {
							// console.log("resolve node module", relativeDependency, "from", nodeLocation)
							const moduleLocation = locateNodeModule(relativeDependency, nodeLocation)
							// console.log("module found at", moduleLocation)
							action.pass(moduleLocation)
						} catch (e) {
							if (e && e.code === "MODULE_NOT_FOUND") {
								// console.log("no module found")
								action.fail({ status: 404 })
							} else {
								throw e
							}
						}
						return action
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
			createFileService({
				locate: ({ url }) => {
					const fileURL = new URL(url.pathname.slice(1), `file:///${location}/`)
					return fileURL
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
