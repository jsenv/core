// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js
import { transform } from "babel-core"
import path from "path"

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
	module: true,
}

const createSourceMapURL = (filename) => {
	const sourceMapBasename = `${path.basename(filename)}.map`
	const sourceMapUrl = path.join(path.dirname(filename), sourceMapBasename)
	return sourceMapUrl.replace(/\\/g, "/")
}

const appendSourceURL = (code, sourceURL) => {
	return `${code}
//# sourceURL=${sourceURL}`
}

const appendSourceMappingURL = (code, sourceMappingURL) => {
	return `${code}
//# sourceMappingURL=${sourceMappingURL}`
}

export const createTranspiler = (transpilerOptions = {}) => {
	const transpile = (inputCode, transpileOptions = {}) => {
		// https://babeljs.io/docs/core-packages/#options
		const options = { ...defaultOptions, ...transpilerOptions, ...transpileOptions }

		const { minify, sourceRoot, module, filenameRelative, filename } = options

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
			sourceRoot,
			filenameRelative,
			plugins: Object.keys(plugins)
				.filter((name) => Boolean(plugins[name]))
				.map((name) => [name, plugins[name]]),
			ast: true,
			sourceMaps: true,
			compact,
			comments,
			minified,
		}

		const { code, ast, map } = transform(inputCode, babelOptions)
		const relativeMapPath = createSourceMapURL(filenameRelative)

		return Promise.resolve({
			ast,
			code: appendSourceMappingURL(appendSourceURL(code, `${filenameRelative}`), relativeMapPath),
			map,
			relativeMapPath,
		})
	}

	return {
		transpile,
	}
}
