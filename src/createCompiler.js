import { createTranspiler } from "./createTranspiler.js"
import { createInstrumenter } from "./createInstrumenter.js"
import { writeFileFromString } from "./writeFileFromString.js"
import path from "path"
import { passed, all } from "@dmail/action"

const normalizeSeparation = (filename) => filename.replace(/\\/g, "/")

const createSourceMapURL = (filename) => {
	const sourceMapBasename = `${path.basename(filename)}.map`
	const sourceMapUrl = path.join(path.dirname(filename), sourceMapBasename)
	return normalizeSeparation(sourceMapUrl)
}

const createOutputCodeURL = (inputCodeRelativeLocation) => {
	return `${path.dirname(inputCodeRelativeLocation)}/${path.basename(
		inputCodeRelativeLocation,
		".js",
	)}.es5.js`
}

const appendSourceURL = (code, sourceURL) => {
	return `${code}
//# sourceURL=${sourceURL}`
}

const appendSourceMappingURL = (code, sourceMappingURL) => {
	return `${code}
//# sourceMappingURL=${sourceMappingURL}`
}

export const createCompiler = ({ enableCoverage = false } = {}) => {
	let { transpile } = createTranspiler()

	if (enableCoverage) {
		const coverageGlobalVariableName = "__coverage__"
		const { instrument } = createInstrumenter({ coverageGlobalVariableName })

		const oldTranspile = transpile
		transpile = (...args) => {
			return oldTranspile(...args).then(({ outputCode, outputSourceMap }) => {
				return instrument({ inputCode: outputCode, inputSourceMap: outputSourceMap })
			})
		}
	}

	const locateFile = ({ location, relativeLocation }) => {
		return normalizeSeparation(path.resolve(location, relativeLocation))
	}

	const compile = ({
		location,
		inputCode,
		inputCodeRelativeLocation,
		outputFolderRelativeLocation = "build/transpiled",
	}) => {
		location = normalizeSeparation(location)

		return transpile({
			location: `${outputFolderRelativeLocation}`,
			inputCode,
			inputCodeRelativeLocation,
		}).then(({ outputCode, outputCodeSourceMap }) => {
			const inputCodeCopyRelativeLocation = `${outputFolderRelativeLocation}/${inputCodeRelativeLocation}`
			const outputCodeFilename = createOutputCodeURL(inputCodeRelativeLocation)
			const outputCodeRelativeLocation = `${outputFolderRelativeLocation}/${outputCodeFilename}`
			const outputCodeSourceMapRelativeLocation = `${outputFolderRelativeLocation}/${createSourceMapURL(
				outputCodeFilename,
			)}`

			outputCode = appendSourceMappingURL(
				appendSourceURL(outputCode, `/${inputCodeCopyRelativeLocation}`),
				`/${outputCodeSourceMapRelativeLocation}`,
			)

			const ensureOnFileSystem = () => {
				const inputCodeCopyLocation = `${location}/${inputCodeCopyRelativeLocation}`
				const inputCodeCopyAction = writeFileFromString(inputCodeCopyLocation, inputCode)

				const outputCodeLocation = `${location}/${outputCodeRelativeLocation}`
				const outputCodeAction = writeFileFromString(outputCodeLocation, outputCode)

				// we could remove sources content, they can be fetched from server
				// but why removing them after all
				// if (outputCodeSourceMap) {
				// 	delete outputCodeSourceMap.sourcesContent
				// }
				const outputCodeSourceMapLocation = `${location}/${outputCodeSourceMapRelativeLocation}`
				const outputCodeSourceMapAction = outputCodeSourceMap
					? writeFileFromString(outputCodeSourceMapLocation, JSON.stringify(outputCodeSourceMap))
					: passed()

				return all([inputCodeCopyAction, outputCodeAction, outputCodeSourceMapAction])
			}

			return {
				location,
				inputCodeRelativeLocation,
				inputCode,
				inputCodeCopyRelativeLocation,
				outputCodeRelativeLocation,
				outputCode,
				outputCodeSourceMap,
				outputCodeSourceMapRelativeLocation,
				ensureOnFileSystem,
			}
		})
	}

	return { compile, locateFile }
}

// const base64Encode = (string) => new Buffer(string).toString("base64")
// // should I unescape(encodeURIComponent()) the base64 string ?
// // apprently base64 encode is enought, no need to unescape a base64 encoded string
// const finalMapLocation = `data:application/json;base64,${base64Encode(
// 	JSON.stringify(instrumentedSourceMap),
// )}`

// if (filename.startsWith("file:///")) {
// 	filename = filename.slice("file:///".length)
// }
