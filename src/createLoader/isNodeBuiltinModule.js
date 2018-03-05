import Module from "module"
import repl from "repl"

export const isNodeBuiltinModule = (moduleName) => {
	// https://nodejs.org/api/modules.html#modules_module_builtinmodules
	if ("builtinModules" in Module) {
		return Module.builtinModules.includes(moduleName)
	}
	// https://stackoverflow.com/a/35825896
	return repl._builtinLibs.includes(moduleName)
}
