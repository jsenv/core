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

const createTranspileService = ({ location, include = () => true, compiler } = {}) => {
	return ({ method, url }) => {
		if (!include(url)) {
			return
		}

		if (method === "GET" || method === "HEAD") {
			const inputCodeRelativeLocation = url.pathname.slice(1)
			const inputCodeLocation = compiler.locateFile({
				location,
				relativeLocation: inputCodeRelativeLocation,
			})

			return readFileAsString({
				location: inputCodeLocation,
				errorMapper: convertFileSystemErrorToResponseProperties,
			}).then((inputCode) => {
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
		}

		return {
			status: 501,
		}
	}
}

export const startTranspileServer = ({ url, location }) => {
	const compiler = createCompiler()

	const handler = createResponseGenerator({
		services: [
			createFileService({
				location,
				include: ({ pathname }) => pathname.startsWith("/build/transpiled"),
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
