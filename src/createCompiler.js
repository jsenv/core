import { createTranspiler } from "./createTranspiler.js"
import { createInstrumenter } from "./createInstrumenter.js"
import { readFileAsString } from "./readFileAsString.js"
import { writeFileFromString } from "./writeFileFromString.js"
import { pathIsInside } from "./pathIsInside.js"
import path from "path"

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

// const base64Encode = (string) => new Buffer(string).toString("base64")
// // should I unescape(encodeURIComponent()) the base64 string ?
// // apprently base64 encode is enought, no need to unescape a base64 encoded string
// const finalMapLocation = `data:application/json;base64,${base64Encode(
// 	JSON.stringify(instrumentedSourceMap),
// )}`

// if (filename.startsWith("file:///")) {
// 	filename = filename.slice("file:///".length)
// }

export const createCompiler = ({ packagePath, enableCoverage = false }) => {
	packagePath = normalizeSeparation(packagePath)

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

	const compileFile = (location) => {
		const inputCodeLocation = path.resolve(packagePath, location)
		if (pathIsInside(inputCodeLocation, packagePath) === false) {
			throw new Error(`${location} must be inside ${packagePath}`)
		}

		const inputCodeRelativeLocation = normalizeSeparation(
			path.relative(packagePath, inputCodeLocation),
		)

		return readFileAsString(inputCodeLocation).then((content) => {
			return transpile({
				inputRoot: packagePath,
				inputCode: content,
				inputCodeRelativeLocation,
			}).then(({ outputCode, outputCodeSourceMap }) => {
				const outputCodeRelativeLocation = `build/transpiled/${inputCodeRelativeLocation}`
				const outputCodeLocation = `${packagePath}/${outputCodeRelativeLocation}`
				const outputCodeSourceMapRelativeLocation = `build/transpiled/${createSourceMapURL(
					inputCodeRelativeLocation,
				)}`
				const outputCodeSourceMapLocation = `${packagePath}/${outputCodeSourceMapRelativeLocation}`

				outputCode = appendSourceMappingURL(
					appendSourceURL(outputCode, `${inputCodeRelativeLocation}`),
					outputCodeSourceMapRelativeLocation,
				)

				const mapPromise = outputCodeSourceMap
					? writeFileFromString(outputCodeSourceMapLocation, JSON.stringify(outputCodeSourceMap))
					: Promise.resolve()
				const codePromise = writeFileFromString(outputCodeLocation, outputCode)

				return Promise.all([mapPromise, codePromise]).then(() => {
					return {
						root: packagePath,
						inputCodeRelativeLocation,
						inputCode: content,
						outputCodeRelativeLocation,
						outputCode,
						outputCodeSourceMap,
						outputCodeSourceMapRelativeLocation,
					}
				})
			})
		})
	}

	return { compileFile }
}
