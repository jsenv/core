import istanbul from "istanbul"

export const getCoverageGlobalVariableName = () => {
	for (const key in global) {
		if (key.match(/\$\$cov_\d+\$\$/)) {
			return key
		}
	}
	return null
}

const base64Encode = (string) => new Buffer(string).toString("base64")

/*

TODO
- do not hardcode !transpiled
- I do not unescape(encodeURIComponent()) the base64 string, what are the consequences?
-> apparently it's ok with the custom base64 encode according to mozilla documentation

*/

export const createInstrumenter = ({ globalName = "__coverage__" } = {}) => {
	const istanbulInstrumenter = new istanbul.Instrumenter({
		coverageVariable: globalName,
		esModules: true,
	})

	const instrument = (code, { filename }) => {
		if (filename.startsWith("file:///")) {
			filename = filename.slice("file:///".length)
		}

		// hardcoded for now but should be added only if there is a sourcemap on sourceContent
		filename += "!transpiled"

		istanbulInstrumenter.opts.codeGenerationOptions = {
			// il faut passer le fichier d'origine, sauf que ce fichier n'est pas dispo sur le fs puisque transpiled
			// il le sera ptet par la suite
			sourceMap: filename,
			sourceContent: code,
			sourceMapWithCode: true,
			file: filename,
		}

		// tod: put this to true if the instrumented module is anonymous
		// a way to know if the module is register anonymously doing System.module is to check if it's adress looks like
		// '<Anonymous Module ' + ++anonCnt + '>';
		// https://github.com/ModuleLoader/es6-module-loader/issues/489
		// but if the anonymous module provide an adresse you're fucked and if a normal module use <Anonymous Module 1>
		// you would register it by mistake
		// for now we will enable embedSource if the load.address includes anonymous somewhere
		if (filename.includes("anonymous")) {
			istanbulInstrumenter.opts.embedSource = true
		} else {
			istanbulInstrumenter.opts.embedSource = false
		}

		// https://github.com/karma-runner/karma-coverage/pull/146/files
		let instrumentedSource = istanbulInstrumenter.instrumentSync(code, filename)

		const instrumentedSourceMapString = istanbulInstrumenter.lastSourceMap().toString()

		// I suppose it's a way to merge sourcemap into one
		// var consumer = new SourceMap.SourceMapConsumer(instrumentedSourceMap);
		// var generator = SourceMap.SourceMapGenerator.fromSourceMap(consumer);
		// generator.applySourceMap(new SourceMap.SourceMapConsumer(file.sourceMap));
		// var finalSourceMap = generator.toString();

		// we use variable for sourceURL & sourceMappingURLName to prevent something parsing this file
		// to believe it conains sourceMap
		const sourceURLName = "sourceURL"
		const sourceMappingURLName = "sourceMappingURL"

		instrumentedSource += `
//# ${sourceURLName}=${filename}!instrumented
//# ${sourceMappingURLName}=data:application/json;base64,${base64Encode(
			instrumentedSourceMapString,
		)}`

		return instrumentedSource
	}

	return {
		instrument,
	}
}
