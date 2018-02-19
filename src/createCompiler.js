import { createTranspiler } from "./createTranspiler.js"
import { createInstrumenter } from "./createInstrumenter.js"
import { readFileAsString } from "./readFileAsString.js"
// import vm from "vm"
// import path from "path"

// const rootFolder = path.resolve(__dirname, "../../").replace(/\\/g, "/")
// const projectRoot = path.resolve(rootFolder, "../").replace(/\\/g, "/")

/*
ce qu'il faut faire:

- démarrer un serveur qui va compiler les fichiers à la volée quand on lui demande
- il va mettre ces fichiers kkpart dans le filesystem genre build/* et retourner
une version transpilé ou transpilé + instrumenté
- ensuite nodejs aura "plus qu'à" faire un System.import() du fichier
- nodejs renverras aussi le coverage.json à une url spécifique au besoin

problème: systemjs ne support par les url http sous nodejs
il faut donc lui faire un truc vite fait pour que ça marche

on utilisera le systemjs qui supporte fetch

import fetch from "node-fetch"

global.fetch = fetch
*/

export const createCompiler = ({ coverageGlobalVariableName = "__coverage__" } = {}) => {
	const { transpile } = createTranspiler()
	const compileFile = (filename) => {
		return readFileAsString(filename)
			.then((code) => transpile(code, { filename }))
			.then((transpiledCode) => {
				// écrire ce fichier dans build/transpiled/*
				return transpiledCode
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
