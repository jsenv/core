System.register([__v__("/jsenv_core_packages.js")], function (_export, _context) {
  "use strict";

  var _slicedToArray, _objectSpread2, getResponse, _getResponse, _getResponse2, answer, a;
  return {
    setters: [function (_buildJsenv_core_packagesJs) {
      _slicedToArray = _buildJsenv_core_packagesJs._slicedToArray;
      _objectSpread2 = _buildJsenv_core_packagesJs._objectSpread2;
    }],
    execute: function () {
      getResponse = () => {
        return [42];
      };
      _getResponse = getResponse(), _getResponse2 = _slicedToArray(_getResponse, 1), answer = _getResponse2[0];
      console.log(_objectSpread2({}, {
        answer
      }));
      _export("a", a = "a");
    }
  };
});