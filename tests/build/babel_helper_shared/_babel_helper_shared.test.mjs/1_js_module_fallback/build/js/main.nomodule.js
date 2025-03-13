System.register([__v__("/jsenv_core_packages.js")], function (_export, _context) {
  "use strict";

  var _slicedToArray;
  return {
    setters: [function (_buildJsenv_core_packagesJs) {
      _slicedToArray = _buildJsenv_core_packagesJs._slicedToArray;
    }],
    execute: function () {
      Promise.all([_context.import(__v__("/js/a.nomodule.js")), _context.import(__v__("/js/b.nomodule.js"))]).then(_ref => {
        let _ref2 = _slicedToArray(_ref, 2),
          a = _ref2[0].a,
          b = _ref2[1].b;
        window.resolveResultPromise({
          a,
          b
        });
      });
    }
  };
});