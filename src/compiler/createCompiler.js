// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import path from "path"
import { passed } from "@dmail/action"
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

export const normalizeSeparation = (filename) => filename.replace(/\\/g, "/")

export const createCompiler = ({ ...compilerOptions } = {}) => {
	const locateFile = ({ location, relativeLocation }) => {
		return normalizeSeparation(path.resolve(location, relativeLocation))
	}

	const compile = ({ inputRelativeLocation, input, ...compileOptions }) => {
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
			const format = moduleFormats.detect(input)
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
			filenameRelative: inputRelativeLocation,
			plugins: babelPlugins,
			ast: true,
			sourceMaps: true,
			compact,
			comments,
			minified,
			inputSourceMap: inputCodeSourceMap,
		}

		const {
			code,
			// ast: transpiledCodeAst,
			map,
		} = transform(input, babelOptions)

		return passed({
			code,
			map,
		})
	}

	return { compile, locateFile }
}
