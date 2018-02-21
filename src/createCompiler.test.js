import { createCompiler } from "./createCompiler.js"
import { test } from "@dmail/test"
import path from "path"
import assert from "assert"

test(() => {
	const packagePath = path.resolve(__dirname, "../../src/__test__")

	const compiler = createCompiler({
		packagePath,
	})

	return compiler
		.compileFile(`${packagePath}/file.js`)
		.then(
			({
				root,
				inputCodeRelativeLocation,
				outputCodeRelativeLocation,
				inputCode,
				outputCode,
				outputCodeSourceMap,
				outputCodeSourceMapRelativeLocation,
			}) => {
				assert.equal(typeof root, "string")
				assert.equal(inputCodeRelativeLocation, "file.js")
				assert.equal(outputCodeRelativeLocation, "build/transpiled/file.js")
				assert.equal(outputCodeSourceMapRelativeLocation, "build/transpiled/file.js.map")
				assert.equal(inputCode, "export default true\n")
				assert.equal(typeof outputCode, "string")
				assert.equal(typeof outputCodeSourceMap, "object")
			},
		)
})
