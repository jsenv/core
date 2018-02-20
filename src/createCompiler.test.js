import { createCompiler } from "./createCompiler.js"
import { test } from "@dmail/test"
import path from "path"
import assert from "assert"

test(() => {
	// ce fichier est éxécuté depuis dist MAIS
	// il faut faire comme si il était éxécuté depuis le fichier d'origine
	// car c'est le fichier d'origine qu'on veut compiler
	const packagePath = path.resolve(__dirname, "../../src/__test__")

	const compiler = createCompiler({
		packagePath,
	})

	return compiler
		.compileFile(`${packagePath}/file.js`)
		.then(
			({
				root,
				relativeFileLocation,
				compiledRelativeFileLocation,
				compiledRelativeMapLocation,
				content,
				compiledContent,
				compiledMap,
			}) => {
				assert.equal(typeof root, "string")
				assert.equal(relativeFileLocation, "file.js")
				assert.equal(compiledRelativeFileLocation, "build/transpiled/file.js")
				assert.equal(compiledRelativeMapLocation, "build/transpiled/file.js.map")
				assert.equal(content, "export default true\n")
				assert.equal(typeof compiledContent, "string")
				assert.equal(typeof compiledMap, "object")
			},
		)
})
