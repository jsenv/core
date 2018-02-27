import "./global-fetch.js"
import { startTranspileServer } from "./startTranspileServer.js"
import SystemJS from "systemjs"
import path from "path"
import { fromPromise } from "@dmail/action"
import { test } from "@dmail/test"
import assert from "assert"
import { URL } from "url"

// on est pas forcé de démarrer un serveur grâce au truc utilisé dans createSystem
// on pourrait utiliser le compiler directement
// mais pour le browser on aura  pas le choix donc autant utiliser
// le truc le plus puissant et compliqué dès maintenant

const testImport = (relativeFileLocation) => {
	return startTranspileServer({
		location: `${path.resolve(__dirname, "../../src/__test__")}/`,
	}).then(({ url, close }) => {
		const System = new SystemJS.constructor()
		System.config({
			baseURL: String(url),
		})
		const absoluteFileURL = new URL(relativeFileLocation, url)
		return fromPromise(System.import(absoluteFileURL.toString())).then((value) => {
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
	return testImport("./file-with-cjs-import.js").then((bindings) => {
		assert.equal(bindings.default, "aaa")
	})
})

// comme on pouvait s'y attendre ça ne marche pas
// surement parce que systemjs ne connait pas la location réelle de
// bbb/node_modules/mains.js donc échoue lorsqu'il cherche à load la dépendance
// une manière de résoudre ça pourrait tout simplement être d'écrire
// import bbb from "node_modules/bbb/index.js"
// au lieu du truc complètement magique import bbb from "bbb"
test(() => {
	return testImport("./file-with-cjs-import-2.js").then((bindings) => {
		assert.equal(bindings.default, "bbb")
	})
})
