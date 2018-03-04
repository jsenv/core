// https://babeljs.io/docs/plugins/
export const defaultPlugins = {
	// "transform-async-to-generator": {},
	"transform-es2015-arrow-functions": {},
	"transform-es2015-block-scoping": {},
	"transform-es2015-block-scoped-functions": {},
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
	// https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-dynamic-import
}

export const minifyPlugins = {
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
