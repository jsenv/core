import { createCompiler } from "./createCompiler.js"
import { test } from "@dmail/test"
import path from "path"
import assert from "assert"

test(() => {
	const location = path.resolve(__dirname, "../../src/__test__")
	const inputCode = "export default true"
	const compiler = createCompiler()

	return compiler
		.compile({
			location,
			inputCode,
			inputCodeRelativeLocation: "file.js",
		})
		.then(
			({
				location: compileLocation,
				inputCode: compileInputCode,
				inputCodeRelativeLocation,
				inputCodeCopyRelativeLocation,
				outputCode,
				outputCodeRelativeLocation,
				outputCodeSourceMap,
				outputCodeSourceMapRelativeLocation,
			}) => {
				assert.equal(compileLocation, location)
				assert.equal(inputCodeRelativeLocation, "file.js")
				assert.equal(inputCodeCopyRelativeLocation, "build/transpiled/file.js")
				assert.equal(outputCodeRelativeLocation, "build/transpiled/file.es5.js")
				assert.equal(outputCodeSourceMapRelativeLocation, "build/transpiled/file.es5.js.map")
				assert.equal(compileInputCode, inputCode)
				assert.equal(typeof outputCode, "string")
				assert.equal(typeof outputCodeSourceMap, "object")
			},
		)
})
