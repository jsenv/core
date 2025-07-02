function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var lib = {};

var foo = {};

var hasRequiredFoo;

function requireFoo () {
	if (hasRequiredFoo) return foo;
	hasRequiredFoo = 1;
	try {
	  console.log("toto");
	} catch {
	  console.error("An error occurred");
	}
	return foo;
}

var hasRequiredLib;

function requireLib () {
	if (hasRequiredLib) return lib;
	hasRequiredLib = 1;

	requireFoo();
	return lib;
}

var libExports = requireLib();
var __jsenv_default_import__ =              getDefaultExportFromCjs(libExports);

export { __jsenv_default_import__ as default };