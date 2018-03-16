import { rollup } from "rollup"
import nodeResolve from "rollup-plugin-node-resolve"
import { writeFileFromString } from "../writeFileFromString"
import path from "path"
import { all } from "@dmail/action"

const projectRoot = path.resolve(__dirname, "../../../")

const variables = {
	node: {
		inputFile: `${projectRoot}/src/createLoader/createNodeLoader/index.js`,
		outputFile: `${projectRoot}/src/createLoader/createNodeLoader/dist/index.cjs.js`,
		outputFileSourcemap: `${projectRoot}/src/createLoader/createNodeLoader/dist/index.cjs.js.map`,
		outputFormat: "cjs",
	},
	browser: {
		inputFile: `${projectRoot}/src/createLoader/createBrowserLoader/index.js`,
		outputFile: `${projectRoot}/src/createLoader/createBrowserLoader/dist/index.global.js`,
		outputFileSourcemap: `${projectRoot}/src/createLoader/createBrowserLoader/dist/index.global.js.map`,
		outputFormat: "iife",
	},
}

export const build = ({
	type, // node or browser
}) => {
	const { inputFile, outputFile, outputFileSourcemap, outputFormat } = variables[type]

	return rollup({
		entry: inputFile,
		plugins: [
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
			// we must append //sourceMappingURL to code but let's ignore that for now
			return all([
				writeFileFromString({
					location: outputFile,
					string: code,
				}),
				writeFileFromString({
					location: outputFileSourcemap,
					string: JSON.stringify(map),
				}),
			]).then(() => {
				return { code, map }
			})
		})
}
