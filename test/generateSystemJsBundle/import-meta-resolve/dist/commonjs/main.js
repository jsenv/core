System.register([], function (exports, module) {
	'use strict';
	return {
		execute: function () {

			var basic = exports('basic', module.meta.resolve("./file.js"));
			var remapped = exports('remapped', module.meta.resolve("foo"));

		}
	};
});
//# sourceMappingURL=main.js.map
