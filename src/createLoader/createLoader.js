// https://github.com/ModuleLoader/es-module-loader

import RegisterLoader from "es-module-loader/core/register-loader.js"
import { baseURI } from "es-module-loader/core/common.js"
import { resolveIfNotPlain } from "es-module-loader/core/resolve.js"

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

	return loader
}
