import { writeFileFromString } from "./writeFileFromString.js"
import { all } from "@dmail/action"

const writeSourceLocation = ({ code, location }) => {
	return `${code}
//# sourceURL=${location}`
}

const writeSourceMapLocation = ({ code, location }) => {
	return `${code}
//# sourceMappingURL=${location}`
}

export const writeCompilationResultOnFileSystem = ({
	output,
	source,
	sourceMap,
	location,
	outputRelativeLocation,
	sourceRelativeLocation,
	sourceMapRelativeLocation,
}) => {
	const actions = []

	// source
	if (typeof source === "string" && sourceRelativeLocation) {
		const sourceServerLocation = `${location}/${sourceRelativeLocation}`
		const sourceClientLocation = `/${sourceRelativeLocation}`

		output = writeSourceLocation({ code: output, location: sourceClientLocation })
		actions.push(
			writeFileFromString({
				location: sourceServerLocation,
				string: source,
			}),
		)
	}

	// sourceMap
	if (typeof sourceMap === "object" && sourceMapRelativeLocation) {
		// delete sourceMap.sourcesContent
		// we could remove sources content, they can be fetched from server
		// but removing them will decrease size of sourceMap but force
		// the client to fetch the source resulting in an additional http request

		// the client wont be able to fecth a sourceMapServerLocation like
		// /Users/damien/dev/github/dev-server/src/__test__/build/transpiled/file.js
		// so assuming server serve file at /Users/damien/dev/github/dev-server/src/__test__ it becomes
		// /build/transpiled/file.js
		const sourceMapServerLocation = `${location}/${sourceMapRelativeLocation}`
		const sourceMapClientLocation = `/${sourceMapRelativeLocation}`
		// we could delete sourceMap.sourceRoot to ensure clientLocation is absolute
		// but it's not set anyway because not passed to babel during compilation

		output = writeSourceMapLocation({ code: output, location: sourceMapClientLocation })
		actions.push(
			writeFileFromString({
				location: sourceMapServerLocation,
				string: JSON.stringify(sourceMap),
			}),
		)
	}

	// output
	actions.push(
		writeFileFromString({
			location: `${location}/${outputRelativeLocation}`,
			string: output,
		}),
	)

	return all(actions).then(() => output)
}
