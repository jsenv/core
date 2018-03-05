import Module from "module"

// le code ci-dessous peut être utilisé afin d'éviter la dépendence vers resolve@1.5.0
export const locateNodeModule = (moduleLocation, location) => {
	const requireContext = new Module(location)
	requireContext.paths = Module._nodeModulePaths(location)
	return Module._resolveFilename(moduleLocation, requireContext, true)
}
