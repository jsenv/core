// import { createFileService } from "./createFileService.js"
import { createResponseGenerator } from "./createResponseGenerator.js"
import { createNodeRequestHandler } from "./createNodeRequestHandler.js"
import { startServer } from "./startServer.js"
import {
	convertFileSystemErrorToResponseProperties,
	createFileService,
} from "./createFileService.js"
import { createCompiler } from "./createCompiler.js"
import { readFileAsString } from "./readFileAsString.js"
import { passed } from "@dmail/action"
// import path from "path"

const locateNodeModule = ({ location, relativeLocation }) => {
	try {
		const moduleEntryLocation = require.resolve(relativeLocation, {
			paths: [`${location}`],
		})
		return `${moduleEntryLocation}`
	} catch (e) {
		return null
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

		/*
		ce qu'il faut faire:

		une requête vers node_modules/aaa/index.js
		même si au final le fichier se trouve dans ../../node_modules/aaa/index.js
		on créera

		build/transpiled/node_modules/aaa/index.js
		build/transpiled/node_modules/aaa/index.es5.js
		build/transpiled/node_modules/aaa/index.es5.js.map

		index.es5.js contiendra
		/# sourceURL = build/transpiled/node_modules/aaa/index.js
		/# sourceMappingURL = build/transpiled/node_modules/aaa/index.es5.js.map

		index.es5.js.map on verra

		donc quand une requête vers build/transpiled arrive on se prend pas la tête on sers le fichier

		lorsque la requête vers https://localhost:0/node_modules/aaa/index.js arrive
		on cherche ou ça se trouve vraiment sur le filesystem avec require.resolve()
		juste pour pouvoir lire le fichier mais on fait comme si le fichier se trouvait vraiment là
		*/

		const locate = (relativeLocation) => {
			if (relativeLocation.startsWith("node_modules/")) {
				// redirect https://locahost:0/node_modules/aaa/main.js to
				// either file:///Users/damien/github/dev-server/node_modules/aaa/main.js
				// or even file:///Users/damien/github/node_modules/aaa/main.js

				const nodeRelativeLocation = relativeLocation.slice("node_modules/".length)
				// for something like 'node_modules/aaa/mains.js' you get 'aaa/main.js'
				return locateNodeModule({
					location,
					relativeLocation: nodeRelativeLocation,
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

	// const transpiledFolderHref = new URL("build/transpiled", location).href
	// debugger

	const handler = createResponseGenerator({
		services: [
			createDefaultFileService({ defaultFile: "index.js" }),
			createFileService({
				location,
				include: ({ pathname }) => pathname.startsWith("build/transpiled/"),
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
