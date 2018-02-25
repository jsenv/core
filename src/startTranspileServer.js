// import { createFileService } from "./createFileService.js"
import { createResponseGenerator } from "./createResponseGenerator.js"
import { createNodeRequestHandler } from "./createNodeRequestHandler.js"
import { startServer } from "./startServer.js"
import { convertFileSystemErrorToResponseProperties } from "./createFileService.js"
import { createCompiler } from "./createCompiler.js"
import path from "path"

const createTranspileService = ({ include = () => true, compiler } = {}) => {
	return ({ method, url }) => {
		if (!include(url)) {
			return
		}

		if (method === "GET" || method === "HEAD") {
			return compiler.compileFile(url.pathname.slice(1)).then(({ outputCode }) => {
				return {
					status: 200,
					headers: {
						"content-length": Buffer.byteLength(outputCode),
						"cache-control": "no-cache",
					},
					body: outputCode,
				}
			}, convertFileSystemErrorToResponseProperties)
		}

		return {
			status: 501,
		}
	}
}

export const startTranspileServer = ({ url }) => {
	const packagePath = path.resolve(__dirname, "../../src/__test__")

	const compiler = createCompiler({
		packagePath,
	})

	const handler = createResponseGenerator({
		services: [
			createTranspileService({
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
