import { passed } from "@dmail/action"
import path from "path"
import { writeCompilationResultOnFileSystem } from "../writeCompilationResultOnFileSystem.js"
import { normalizeSeparation } from "../compiler/createCompiler.js"

export const createCompileService = ({
	include = () => true,
	location,
	locate,
	fetch,
	transform,
	outputFolderRelativeLocation = "build/transpiled",
} = {}) => {
	return ({ method, url }) => {
		if (!include(url)) {
			return
		}

		if (method !== "GET" && method !== "HEAD") {
			return {
				status: 501,
			}
		}

		const inputRelativeLocation = url.pathname.slice(1)

		return passed(locate(inputRelativeLocation)).then((inputLocation) => {
			return passed(fetch(inputLocation)).then((input) => {
				return passed(transform({ input, inputRelativeLocation })).then(({ code, map }) => {
					const output = code
					const sourceRelativeLocation = `${outputFolderRelativeLocation}/${inputRelativeLocation}`
					const source = input
					const sourceMapRelativeLocation = normalizeSeparation(
						path.join(
							outputFolderRelativeLocation,
							path.dirname(inputRelativeLocation),
							`${path.basename(inputRelativeLocation, ".js")}.es5.js.map`,
						),
					)
					const sourceMap = map
					const outputRelativeLocation = normalizeSeparation(
						path.join(
							outputFolderRelativeLocation,
							path.dirname(inputRelativeLocation),
							`${path.basename(inputRelativeLocation, ".js")}.es5.js`,
						),
					)

					return writeCompilationResultOnFileSystem({
						output,
						source,
						sourceMap,
						location,
						sourceRelativeLocation,
						sourceMapRelativeLocation,
						outputRelativeLocation,
					}).then(() => {
						return {
							status: 200,
							headers: {
								"content-length": Buffer.byteLength(output),
								"cache-control": "no-cache",
							},
							body: output,
						}
					})
				})
			})
		})
	}
}
