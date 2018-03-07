// https://github.com/ModuleLoader/browser-es-module-loader
// on devrait plutôt utiliser https://github.com/ModuleLoader/system-register-loader
// voir ça aussi https://github.com/ModuleLoader/node-es-module-loader/blob/master/src/node-es-module-loader.js
// on met le source de es-module-loader directement ici parce que
// il a besoin de le compiler, y'a ptet moyen d'éviter ça en précisant à babel
// de le compiler et en le récupérant avec ../node_modules/es-module-loader ?

import RegisterLoader from "./es-module-loader/core/register-loader.js"
import { baseURI } from "./es-module-loader/core/common.js"
import { resolveIfNotPlain } from "./es-module-loader/core/resolve.js"

export const createLoader = ({
	base,
	resolve = RegisterLoader.prototype[RegisterLoader.resolve],
	instantiate = RegisterLoader.prototype[RegisterLoader.instantiate],
} = {}) => {
	const loader = new RegisterLoader()

	if (base) {
		base = resolveIfNotPlain(base, baseURI) || resolveIfNotPlain(`./${base}`, baseURI)
	} else {
		base = baseURI
	}

	if (base[base.length - 1] !== "/") {
		base += "/"
	}

	loader[RegisterLoader.resolve] = function(key, parent = base) {
		return resolve.call(this, key, parent) || key
	}

	loader[RegisterLoader.instantiate] = instantiate

	// ensure System.register & regirsterDynamic are available
	global.System = global.System || {}
	global.System.register = loader.register.bind(loader)
	global.System.registerDynamic = loader.registerDynamic.bind(loader)

	return loader
}
