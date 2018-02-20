import { createTranspiler } from "./createTranspiler.js"
import { createInstrumenter } from "./createInstrumenter.js"
import { readFileAsString } from "./readFileAsString.js"
import { writeFileFromString } from "./writeFileFromString.js"
import { pathIsInside } from "./pathIsInside.js"
import path from "path"
// import vm from "vm"

// const rootFolder = path.resolve(__dirname, "../../").replace(/\\/g, "/")
// const projectRoot = path.resolve(rootFolder, "../").replace(/\\/g, "/")

const normalizeSeparation = (filename) => filename.replace(/\\/g, "/")

export const createCompiler = ({ packagePath, coverageGlobalVariableName = "__coverage__" }) => {
	packagePath = normalizeSeparation(packagePath)

	const { transpile } = createTranspiler()
	const compileFile = (filepath) => {
		const filename = path.resolve(process.cwd(), filepath)
		if (pathIsInside(filename, packagePath) === false) {
			throw new Error(`${filepath} must be inside ${packagePath}`)
		}

		const relativeFileLocation = normalizeSeparation(path.relative(packagePath, filename))
		const compiledRelativeFileLocation = `build/transpiled/${relativeFileLocation}`
		const compiledFileLocation = `${packagePath}/${compiledRelativeFileLocation}`

		return readFileAsString(filename).then((content) => {
			return transpile(content, {
				sourceRoot: packagePath,
				filenameRelative: relativeFileLocation,
			}).then(({ code, map, relativeMapPath }) => {
				const compiledRelativeMapLocation = `build/transpiled/${relativeMapPath}`
				const compiledMap = `${packagePath}/${compiledRelativeMapLocation}`
				const mapPromise = map
					? writeFileFromString(compiledMap, JSON.stringify(map))
					: Promise.resolve()
				const codePromise = writeFileFromString(compiledFileLocation, code)

				return Promise.all([mapPromise, codePromise]).then(() => {
					return {
						root: packagePath,
						relativeFileLocation,
						compiledRelativeFileLocation,
						compiledRelativeMapLocation,
						content,
						compiledContent: code,
						compiledMap: map,
					}
				})
			})
		})
	}

	const { instrument } = createInstrumenter({ coverageGlobalVariableName })
	const transpileWithCoverage = (code, { filename }) => {
		return transpile(code, { filename }).then((transpiledCode) => {
			return instrument(transpiledCode, { filename })
		})
	}

	const compileFileWithCoverage = (filename) => {
		return readFileAsString(filename)
			.then((code) => transpileWithCoverage(code, { filename }))
			.then((transpiledAndInstrumentedSource) => {
				// écrire dans build/instrumented/*
				return transpiledAndInstrumentedSource
			})
	}

	return {
		compileFile,
		compileFileWithCoverage,
	}
}
