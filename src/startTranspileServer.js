import { createFileService } from "./createFileService.js"
import { createResponseGenerator } from "./createResponseGenerator.js"
import { createNodeRequestHandler } from "./createNodeRequestHandler.js"
import { startServer } from "./startServer.js"

const getFileTranspiledURL = () => {}
const getFileTranspiledAndInstrumentedURL = () => {}

const createTranspileService = ({ include = () => true } = {}) => {
	return ({ method, url }) => {
		if (!include(url)) {
			return
		}

		if (method === "GET" || method === "HEAD") {
			let produce = getFileTranspiledURL

			if (url.searchParams.get("intrument")) {
				produce = getFileTranspiledAndInstrumentedURL
			}

			// si le fichier existe pas 404
			return produce(url.pathname).then(({ filename }) => {
				return {
					status: 302,
					headers: {
						location: filename,
					},
				}
			})
		}

		return {
			status: 501,
		}
	}
}

export const createTranspileServer = ({ url }) => {
	const handler = createResponseGenerator({
		services: [
			createTranspileService({
				include: ({ pathname }) => pathname.startsWith("/build/") === false,
			}),
			createFileService({
				// root: process.cwd(),
				include: ({ pathname }) => pathname.startsWith("/build/"),
			}),
		],
	})

	const nodeRequestHandler = createNodeRequestHandler(handler)

	return startServer({ url, handler: nodeRequestHandler })
}
