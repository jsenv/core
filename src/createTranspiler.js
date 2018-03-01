// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js
import { transform } from "babel-core"
import { passed } from "@dmail/action"

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

// https://babeljs.io/docs/plugins/
const defaultPlugins = {
	// "transform-async-to-generator": {},
	"transform-es2015-arrow-functions": {},
	"transform-es2015-block-scoped-functions": {},
	"transform-es2015-block-scoping": {},
	"transform-es2015-computed-properties": {},
	"transform-es2015-destructuring": {},
	"transform-es2015-for-of": {},
	"transform-es2015-function-name": {},
	"transform-es2015-parameters": {},
	"transform-es2015-shorthand-properties": {},
	"transform-es2015-spread": {},
	"transform-es2015-template-literals": {},
	"transform-es2015-typeof-symbol": {},
	"transform-exponentiation-operator": {},
	// "transform-regenerator": {},
	"transform-object-rest-spread": {},
}

const defaultOptions = {
	minify: false,
	instrument: false,
	module: true,
}

export const createTranspiler = (transpilerOptions = {}) => {
	const transpile = (transpileOptions) => {
		// https://babeljs.io/docs/core-packages/#options
		const options = { ...defaultOptions, ...transpilerOptions, ...transpileOptions }

		const {
			location,
			inputCode,
			inputCodeRelativeLocation,
			inputCodeSourceMap,
			module,
			instrument,
			minify,
		} = options

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
			// babel-plugin-transform-cjs-system-wrapper
			// https://github.com/systemjs/babel-plugin-transform-cjs-system-wrapper
			Object.assign(plugins, {
				"transform-es2015-modules-systemjs": {},
			})
		}

		const babelOptions = {
			sourceRoot: location,
			filenameRelative: inputCodeRelativeLocation,
			plugins: Object.keys(plugins)
				.filter((name) => Boolean(plugins[name]))
				.map((name) => [name, plugins[name]]),
			ast: true,
			sourceMaps: true,
			compact,
			comments,
			minified,
			inputSourceMap: inputCodeSourceMap,
		}

		const {
			code: transpiledCode,
			ast: transpiledCodeAst,
			map: transpiledCodeSourceMap,
		} = transform(inputCode, babelOptions)

		return passed({
			transpiledCodeAst,
			transpiledCode,
			transpiledCodeSourceMap,
		}).then(({ transpiledCode, transpiledCodeSourceMap }) => {
			if (instrument === false) {
				return {
					outputCode: transpiledCode,
					outputCodeSourceMap: transpiledCodeSourceMap,
				}
			}

			return instrument({
				inputCode: transpiledCode,
				inputCodeRelativeLocation,
				inputCodeSourceMap: transpiledCodeSourceMap,
			}).then(({ instrumentedCode, instrumentedCodeSourceMap }) => {
				return {
					outputCode: instrumentedCode,
					outputCodeSourceMap: instrumentedCodeSourceMap,
				}
			})
		})
	}

	return {
		transpile,
	}
}
