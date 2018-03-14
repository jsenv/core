import nodeResolve from "rollup-plugin-node-resolve"

export default {
	entry: "index.js",
	format: "iife",
	moduleName: "createBrowserLoader",
	dest: "index.global.js",

	plugins: [
		nodeResolve({
			module: false,
			jsnext: false,
		}),
	],

	// skip rollup warnings (specifically the eval warning)
	onwarn: function() {},
}
