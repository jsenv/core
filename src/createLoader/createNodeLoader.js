// https://github.com/ModuleLoader/browser-es-module-loader
// on devrait plutôt utiliser https://github.com/ModuleLoader/system-register-loader
// voir ça aussi https://github.com/ModuleLoader/node-es-module-loader/blob/master/src/node-es-module-loader.js
// on met le source de es-module-loader directement ici parce que
// il a besoin de le compiler, y'a ptet moyen d'éviter ça en précisant à babel
// de le compiler et en le récupérant avec ../node_modules/es-module-loader ?

import RegisterLoader from "./es-module-loader/core/register-loader.js"
import { ModuleNamespace } from "./es-module-loader/core/loader-polyfill.js"
import { isNode, baseURI, fileUrlToPath } from "./es-module-loader/core/common.js"
import { resolveIfNotPlain } from "./es-module-loader/core/resolve.js"

import { fetchModuleFromServer, fetchModuleFromFileSystem } from "./nodeFetchModule.js"
import { isNodeBuiltinModule } from "./isNodeBuiltinModule.js"

const fetchModuleSource = (key) => {
	if (key.indexOf("file:") === 0) {
		return fetchModuleFromFileSystem(fileUrlToPath(key))
	}
	if (key.indexOf("http:") === 0 || key.indexOf("https:") === 0) {
		return fetchModuleFromServer(key)
	}
	throw new Error(`unsupport protocol ${key}`)
}

export const createNodeLoader = () => {
	if (!isNode) {
		throw new Error("Node module loader can only be used in Node")
	}

	function NodeLoader(baseKey) {
		if (baseKey) {
			this.baseKey =
				resolveIfNotPlain(baseKey, baseURI) || resolveIfNotPlain(`./${baseKey}`, baseURI)
		} else {
			this.baseKey = baseURI
		}

		if (this.baseKey[this.baseKey.length - 1] !== "/") {
			this.baseKey += "/"
		}

		RegisterLoader.call(this)

		var loader = this

		// ensure System.register & regirsterDynamic are available
		global.System = global.System || {}
		global.System.register = function() {
			loader.register.apply(loader, arguments)
		}
		global.System.registerDynamic = function() {
			loader.registerDynamic.apply(loader, arguments)
		}
	}

	const prototype = Object.create(RegisterLoader.prototype)

	prototype[RegisterLoader.resolve] = function(key, parent) {
		parent = parent || this.baseKey
		return RegisterLoader.prototype[RegisterLoader.resolve].call(this, key, parent) || key
	}

	// instantiate just needs to run System.register
	// so we fetch the source, convert into the System module format, then evaluate it
	prototype[RegisterLoader.instantiate] = function(key, processAnonRegister) {
		if (isNodeBuiltinModule(key)) {
			const nodeBuiltinModuleExports = require(key) // eslint-disable-line import/no-dynamic-require
			return Promise.resolve(
				new ModuleNamespace({
					...nodeBuiltinModuleExports,
					default: nodeBuiltinModuleExports,
				}),
			)
		}

		return fetchModuleSource(key).then((source) => {
			;(0, eval)(source)
			processAnonRegister()
		})
	}

	NodeLoader.prototype = prototype
	const nodeLoader = new NodeLoader()

	return nodeLoader
}
