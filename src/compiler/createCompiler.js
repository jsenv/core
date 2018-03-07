// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { writeFileFromString } from "../writeFileFromString.js"
import path from "path"
import { passed, all } from "@dmail/action"
import { transform } from "babel-core"
import { defaultPlugins, minifyPlugins } from "./plugins.js"
import moduleFormats from "js-module-formats"

import transformESModulesPlugin from "babel-plugin-transform-es2015-modules-systemjs"
import transformCJSModulesPlugin from "babel-plugin-transform-cjs-system-wrapper"
import transformAMDModulesPlugin from "babel-plugin-transform-amd-system-wrapper"
import transformGlobalModulesPlugin from "babel-plugin-transform-global-system-wrapper"

const defaultOptions = {
	minify: false,
	module: true,
}

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

export const createCompiler = ({ ...compilerOptions } = {}) => {
	const locateFile = ({ location, relativeLocation }) => {
		return normalizeSeparation(path.resolve(location, relativeLocation))
	}

	const compile = ({
		location = "temp",
		inputCode,
		inputCodeRelativeLocation = "anonymous.js",
		outputFolderRelativeLocation = "build/transpiled",
		...compileOptions
	}) => {
		location = normalizeSeparation(location)

		// https://babeljs.io/docs/core-packages/#options
		const options = { ...defaultOptions, ...compilerOptions, ...compileOptions }
		const { inputCodeSourceMap, module, minify } = options
		const plugins = { ...defaultPlugins }

		let compact = false
		let comments = false
		let minified = false

		if (minify) {
			compact = true
			comments = true
			minified = true
			Object.assign(plugins, minifyPlugins)
		}

		const babelPlugins = Object.keys(plugins)
			.filter((name) => Boolean(plugins[name]))
			.map((name) => [name, plugins[name]])

		if (module) {
			// https://github.com/ModuleLoader/es-module-loader/blob/master/docs/system-register-dynamic.md
			const format = moduleFormats.detect(inputCode)
			if (format === "es") {
				babelPlugins.unshift(transformESModulesPlugin)
			} else if (format === "cjs") {
				babelPlugins.unshift(transformCJSModulesPlugin)
			} else if (format === "amd") {
				babelPlugins.unshift(transformAMDModulesPlugin)
			} else {
				babelPlugins.unshift(transformGlobalModulesPlugin)
			}
		}

		const babelOptions = {
			sourceRoot: outputFolderRelativeLocation,
			filenameRelative: inputCodeRelativeLocation,
			plugins: babelPlugins,
			ast: true,
			sourceMaps: true,
			compact,
			comments,
			minified,
			inputSourceMap: inputCodeSourceMap,
		}

		const {
			code: outputCode,
			// ast: transpiledCodeAst,
			map: outputCodeSourceMap,
		} = transform(inputCode, babelOptions)

		return passed({
			outputCode,
			outputCodeSourceMap,
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
