function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var lib = {};

var hasRequiredLib;

function requireLib () {
	if (hasRequiredLib) return lib;
	hasRequiredLib = 1;

	return lib;
}

var libExports = requireLib();
var __jsenv_default_import__ =              getDefaultExportFromCjs(libExports);

export { __jsenv_default_import__ as default };