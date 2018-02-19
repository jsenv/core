// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

const minifyPlugins = {
	"minify-constant-folding": {},
	"minify-dead-code-elimination": {
		keepFnName: true,
		keepFnArgs: true,
		keepClassName: true,
	},
	"minify-guarded-expressions": {},
	"minify-mangle-names": {
		keepFnName: true,
		keepClassName: true,
	},
	"minify-simplify": {},
	"minify-type-constructors": {},
	"transform-merge-sibling-variables": {},
	"transform-minify-booleans": {},
	"transform-simplify-comparison-operators": {},
	"transform-undefined-to-void": {},
}

const defaultPlugins = {
	"transform-async-to-generator": {},
	"transform-es2015-arrow-functions": {},
	"transform-es2015-computed-properties": {},
	"transform-es2015-destructuring": {},
	"transform-es2015-for-of": {},
	"transform-es2015-function-name": {},
	"transform-es2015-parameters": {},
	"transform-es2015-shorthand-properties": {},
	"transform-es2015-spread": {},
	"transform-es2015-template-literals": {},
	"transform-exponentiation-operator": {},
	"transform-regenerator": {},
}

const defaultOptions = {
	minify: false,
	module: true,
	filename: "",
}

export const createTranspiler = (transpilerOptions = {}) => {
	const transpile = (code, transpileOptions = {}) => {
		// https://babeljs.io/docs/core-packages/#options
		const options = { ...defaultOptions, ...transpilerOptions, ...transpileOptions }

		const { minify, filename, sourceRoot, module } = options

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

		if (module) {
			Object.assign(plugins, {
				"transform-es2015-modules-systemjs": {},
			})
		}

		const babelOptions = {
			filename,
			plugins: Object.keys(plugins)
				.filter((name) => Boolean(plugins[name]))
				.map((name) => [name, plugins[name]]),
			ast: true,
			sourceMaps: true,
			compact,
			comments,
			minified,
			sourceRoot,
		}

		const babel = require("babel-core")
		let result
		try {
			result = babel.transform(code, babelOptions)
		} catch (e) {
			if (e.name === "SyntaxError" && options.ignoreSyntaxError !== true) {
				console.log("the options", options)
				console.error(e.message, "in", filename, "at\n")
				console.error(e.codeFrame)
			}
			throw e
		}

		return result
	}

	return {
		transpile,
	}
}
