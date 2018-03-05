import "./global-fetch.js"
import { startCompileServer } from "./startCompileServer.js"
import { createNodeLoader } from "./createLoader/createNodeLoader.js"
import path from "path"
import { fromPromise } from "@dmail/action"
import { test } from "@dmail/test"
import assert from "assert"
import { URL } from "url"

// on est pas forcé de démarrer un serveur grâce au truc utilisé dans createSystem
// on pourrait utiliser le compiler directement dans createNodeLoader
// au lieu de fetch le serveur
// mais pour le browser on aura pas le choix donc autant utiliser
// le truc le plus puissant et compliqué dès maintenant

const testImport = (relativeFileLocation) => {
	return startCompileServer({
		location: `${path.resolve(__dirname, "../../src/__test__")}`,
	}).then(({ url, close }) => {
		const loader = createNodeLoader()
		const absoluteFileURL = String(new URL(relativeFileLocation, url))
		return fromPromise(loader.import(absoluteFileURL)).then((value) => {
			return close().then(() => value)
		})
	})
}

test.skip(() => {
	return testImport("./file.js").then((bindings) => {
		assert.equal(bindings.default, true)
	})
})

test.skip(() => {
	return testImport("file-with-node-es6-import.js").then((bindings) => {
		assert.equal(bindings.default, "aaabbb")
	})
})

test.skip(() => {
	return testImport("file-with-relative-cjs-import.js").then((bindings) => {
		assert.equal(bindings.default, "cjs")
	})
})

test(() => {
	return testImport("file-cjs-and-native-require.js").then((bindings) => {
		assert.equal(bindings.default, "createServer")
	})
})
