import { createCompiler } from "./createCompiler.js"
import { test } from "@dmail/test"
import path from "path"
import assert from "assert"

test.skip(() => {
	const location = path.resolve(__dirname, "../../src/__test__")
	const input = "export default true"
	const compiler = createCompiler()

	return compiler
		.compile({
			input,
			location,
			inputRelativeLocation: "file.js",
		})
		.then(({ code, map }) => {
			assert.equal(typeof code, "string")
			assert.equal(typeof map, "object")
		})
})

test(() => {
	const compiler = createCompiler()
	const inputCode = `const value = true`

	return compiler.compile({
		inputCode,
	})
})
