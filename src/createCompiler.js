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
			location,
			inputCode,
			inputCodeRelativeLocation,
		}).then(({ outputCode, outputCodeSourceMap }) => {
			const outputCodeRelativeLocation = `${outputFolderRelativeLocation}/${inputCodeRelativeLocation}`
			const outputCodeSourceMapRelativeLocation = `${outputFolderRelativeLocation}/${createSourceMapURL(
				inputCodeRelativeLocation,
			)}`

			outputCode = appendSourceMappingURL(
				appendSourceURL(outputCode, `${inputCodeRelativeLocation}`),
				outputCodeSourceMapRelativeLocation,
			)

			const ensureOnFileSystem = () => {
				const outputCodeLocation = `${location}/${outputCodeRelativeLocation}`
				const codeAction = writeFileFromString(outputCodeLocation, outputCode)

				const outputCodeSourceMapLocation = `${location}/${outputCodeSourceMapRelativeLocation}`
				const mapAction = outputCodeSourceMap
					? writeFileFromString(outputCodeSourceMapLocation, JSON.stringify(outputCodeSourceMap))
					: passed()

				return all([codeAction, mapAction])
			}

			return {
				location,
				inputCodeRelativeLocation,
				inputCode,
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
