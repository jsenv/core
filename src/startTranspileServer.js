import { createResponseGenerator } from "./createResponseGenerator.js"
import { createNodeRequestHandler } from "./createNodeRequestHandler.js"
import { startServer } from "./startServer.js"
import {
	convertFileSystemErrorToResponseProperties,
	createFileService,
} from "./createFileService.js"
import { createCompiler } from "./createCompiler.js"
import { readFileAsString } from "./readFileAsString.js"
import { passed, createAction } from "@dmail/action"
import { URL } from "url"
import resolveNodeModule from "resolve"
// import path from "path"

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

const createTranspileService = ({ location, include = () => true, compiler } = {}) => {
	return ({ method, url }) => {
		if (!include(url)) {
			return
		}

		if (method !== "GET" && method !== "HEAD") {
			return {
				status: 501,
			}
		}

		const locate = (relativeLocation) => {
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
		}

		const fetchFileSystem = (location) => {
			return readFileAsString({
				location,
				errorMapper: convertFileSystemErrorToResponseProperties,
			})
		}

		const inputCodeRelativeLocation = url.pathname.slice(1)

		return passed(locate(inputCodeRelativeLocation)).then((inputCodeLocation) => {
			return fetchFileSystem(inputCodeLocation).then((inputCode) => {
				return compiler
					.compile({ location, inputCode, inputCodeRelativeLocation })
					.then(({ outputCode, ensureOnFileSystem }) => {
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
					})
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

export const startTranspileServer = ({ url, location }) => {
	const compiler = createCompiler()

	const handler = createResponseGenerator({
		services: [
			createDefaultFileService({ defaultFile: "index.js" }),
			createFileService({
				include: ({ pathname }) => pathname.startsWith("/build/transpiled/"),
				locate: ({ url }) => {
					const fileURL = new URL(url.pathname.slice(1), `file:///${location}/`)
					return fileURL
				},
			}),
			createTranspileService({
				location,
				include: ({ pathname }) => typeof pathname === "string",
				compiler,
			}),
		],
	})

	return startServer({ url }).then(({ url, addRequestHandler, close }) => {
		const nodeRequestHandler = createNodeRequestHandler(handler, url)
		addRequestHandler(nodeRequestHandler)
		return { close, url }
	})
}
