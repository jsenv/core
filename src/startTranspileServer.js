// import { createFileService } from "./createFileService.js"
import { createResponseGenerator } from "./createResponseGenerator.js"
import { createNodeRequestHandler } from "./createNodeRequestHandler.js"
import { startServer } from "./startServer.js"

const getFileTranspiledURL = () => {}

const createTranspileService = ({ include = () => true } = {}) => {
	return ({ method, url }) => {
		if (!include(url)) {
			return
		}

		if (method === "GET" || method === "HEAD") {
			// on a la fonction c'est cool, mais il faudrais la gestion des headers qui vont avec
			// bon pour le moment faisons simple:
			// 200 + content length header + no cache + le fichier
			// ou 404

			return getFileTranspiledURL(url.pathname).then(({ filename }) => {
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
	return startServer({ url }).then(({ addRequestHandler }) => {
		const handler = createResponseGenerator({
			services: [
				createTranspileService({
					include: ({ pathname }) => typeof pathname === "string",
				}),
			],
		})

		const nodeRequestHandler = createNodeRequestHandler(handler)
		addRequestHandler(nodeRequestHandler)
	})
}
