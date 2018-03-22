import { rollup } from "rollup"
import nodeResolve from "rollup-plugin-node-resolve"
import babel from "rollup-plugin-babel"
import path from "path"
import { writeCompilationResultOnFileSystem } from "../writeCompilationResultOnFileSystem.js"
import { createBabelOptions } from "../compiler/createCompiler.js"

const projectRoot = path.resolve(__dirname, "../../../")

const variables = {
	node: {
		outputFormat: "cjs",
		location: `${projectRoot}/src/createLoader/createNodeLoader`,
		inputRelativeLocation: `index.js`,
		outputRelativeLocation: `dist/index.cjs.js`,
		sourceMapRelativeLocation: `dist/index.cjs.js.map`,
	},
	browser: {
		outputFormat: "iife",
		location: `${projectRoot}/src/createLoader/createBrowserLoader`,
		inputRelativeLocation: `index.js`,
		outputRelativeLocation: `dist/index.global.js`,
		sourceMapRelativeLocation: `dist/index.global.js.map`,
	},
}

export const build = ({ type = "browser", minify = false } = {}) => {
	const {
		location,
		inputRelativeLocation,
		outputRelativeLocation,
		sourceMapRelativeLocation,
		outputFormat,
	} = variables[type]

	const inputLocation = `${location}/${inputRelativeLocation}`

	return rollup({
		entry: inputLocation,
		plugins: [
			// please keep in mind babel must not try to convert
			// require(), import or whatever module format is used because rollup takes care of that
			babel(createBabelOptions({ minify })),
			nodeResolve({
				module: false,
				jsnext: false,
			}),
		],
		// skip rollup warnings (specifically the eval warning)
		onwarn: () => {},
	})
		.then((bundle) => {
			return bundle.generate({
				format: outputFormat,
				name: "createBrowserLoader",
				sourcemap: true,
			})
		})
		.then(({ code, map }) => {
			return writeCompilationResultOnFileSystem({
				output: code,
				sourceMap: map,
				location,
				inputRelativeLocation,
				outputRelativeLocation,
				sourceMapRelativeLocation,
			})
		})
}
