import { createLoader } from "./createLoader.js"

import { ModuleNamespace } from "./es-module-loader/core/loader-polyfill.js"
import { isNode, fileUrlToPath } from "./es-module-loader/core/common.js"
import { fetchModuleFromServer, fetchModuleFromFileSystem } from "./nodeFetchModule.js"
import { isNodeBuiltinModule } from "./isNodeBuiltinModule.js"

const fetchModuleSource = (key) => {
	if (key.indexOf("file:") === 0) {
		return fetchModuleFromFileSystem(fileUrlToPath(key))
	}
	if (key.indexOf("http:") === 0 || key.indexOf("https:") === 0) {
		return fetchModuleFromServer(key)
	}
	throw new Error(`unsupported protocol for module ${key}`)
}

export const createNodeLoader = ({ base } = {}) => {
	if (!isNode) {
		throw new Error("Node module loader can only be used in Node")
	}

	return createLoader({
		base,
		instantiate: (key, processAnonRegister) => {
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
		},
	})
}
