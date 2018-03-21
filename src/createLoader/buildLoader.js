import { rollup } from "rollup"
import nodeResolve from "rollup-plugin-node-resolve"
import path from "path"
import { writeCompilationResultOnFileSystem } from "../writeCompilationResultOnFileSystem.js"
import { readFileAsString } from "../readFileAsString"
import { all, fromPromise } from "@dmail/action"

const projectRoot = path.resolve(__dirname, "../../../")

const variables = {
	node: {
		outputFormat: "cjs",
		location: `${projectRoot}/src/createLoader/createNodeLoader`,
		inputRelativeLocation: `index.js`,
		outputRelativeLocation: `dist/index.cjs.js`,
		sourceRelativeLocation: "dist/index.js",
		sourceMapRelativeLocation: `dist/index.cjs.js.map`,
	},
	browser: {
		outputFormat: "iife",
		location: `${projectRoot}/src/createLoader/createBrowserLoader`,
		inputRelativeLocation: `index.js`,
		outputRelativeLocation: `dist/index.global.js`,
		sourceRelativeLocation: "dist/index.js",
		sourceMapRelativeLocation: `dist/index.global.js.map`,
	},
}

export const build = ({
	type, // node or browser
}) => {
	const {
		location,
		inputRelativeLocation,
		sourceRelativeLocation,
		outputRelativeLocation,
		sourceMapRelativeLocation,
		outputFormat,
	} = variables[type]

	const inputLocation = `${location}/${inputRelativeLocation}`

	return all([
		readFileAsString({ location: inputLocation }),
		fromPromise(
			rollup({
				entry: inputLocation,
				plugins: [
					nodeResolve({
						module: false,
						jsnext: false,
					}),
				],
				// skip rollup warnings (specifically the eval warning)
				onwarn: () => {},
			}).then((bundle) => {
				return bundle.generate({
					format: outputFormat,
					name: "createBrowserLoader",
					sourcemap: true,
				})
			}),
		),
	]).then(([input, { code, map }]) => {
		return writeCompilationResultOnFileSystem({
			output: code,
			source: input,
			sourceMap: map,
			location,
			outputRelativeLocation,
			sourceRelativeLocation,
			sourceMapRelativeLocation,
		})
	})
}

build({ type: "browser" })
