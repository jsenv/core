import istanbul from "istanbul"
import { SourceMapConsumer, SourceMapGenerator } from "source-map"
import { passed } from "@dmail/action"

export const getCoverageGlobalVariableName = () => {
	for (const key in global) {
		if (key.match(/\$\$cov_\d+\$\$/)) {
			return key
		}
	}
	return null
}

export const createInstrumenter = ({ globalName = "__coverage__" } = {}) => {
	const istanbulInstrumenter = new istanbul.Instrumenter({
		coverageVariable: globalName,
		esModules: true,
	})

	const instrument = ({ inputCode, inputCodeRelativeLocation, inputCodeSourceMap }) => {
		istanbulInstrumenter.opts.codeGenerationOptions = {
			// il faut passer le fichier d'origine, sauf que ce fichier n'est pas dispo sur le fs puisque transpiled
			// il le sera ptet par la suite
			sourceMap: inputCodeRelativeLocation,
			sourceContent: inputCode,
			sourceMapWithCode: true,
			file: inputCodeRelativeLocation,
		}

		// tod: put this to true if the instrumented module is anonymous
		// a way to know if the module is register anonymously doing System.module is to check if it's adress looks like
		// '<Anonymous Module ' + ++anonCnt + '>';
		// https://github.com/ModuleLoader/es6-module-loader/issues/489
		// but if the anonymous module provide an adresse you're fucked and if a normal module use <Anonymous Module 1>
		// you would register it by mistake
		// for now we will enable embedSource if the load.address includes anonymous somewhere
		if (inputCodeRelativeLocation.includes("anonymous")) {
			istanbulInstrumenter.opts.embedSource = true
		} else {
			istanbulInstrumenter.opts.embedSource = false
		}

		const intrumentedCode = istanbulInstrumenter.instrumentSync(
			inputCode,
			inputCodeRelativeLocation,
		)

		let instrumentedCodeSourceMap = istanbulInstrumenter.lastSourceMap()

		if (inputCodeSourceMap) {
			// https://github.com/karma-runner/karma-coverage/pull/146/files
			const inputCodeSourceMapConsumer = new SourceMapConsumer(inputCodeSourceMap)
			const intrumentedCodeSourceMapConsumer = new SourceMapConsumer(instrumentedCodeSourceMap)
			const generator = SourceMapGenerator.fromSourceMap(intrumentedCodeSourceMapConsumer)
			generator.applySourceMap(inputCodeSourceMapConsumer)
			instrumentedCodeSourceMap = JSON.parse(generator.toString())
		}

		return passed({
			intrumentedCode,
			instrumentedCodeSourceMap,
		})
	}

	return {
		instrument,
	}
}
