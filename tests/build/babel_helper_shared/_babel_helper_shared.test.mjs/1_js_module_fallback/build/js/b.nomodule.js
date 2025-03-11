System.register([__v__("/js/workspaces.nomodule.js")], function (_export, _context) {
  "use strict";

  var _slicedToArray, _objectSpread2, getResponse, _getResponse, _getResponse2, answer, b;
  return {
    setters: [function (_workspacesJs) {
      _slicedToArray = _workspacesJs._slicedToArray;
      _objectSpread2 = _workspacesJs._objectSpread2;
    }],
    execute: function () {
      getResponse = () => {
        return [42];
      };
      _getResponse = getResponse(), _getResponse2 = _slicedToArray(_getResponse, 1), answer = _getResponse2[0];
      console.log(_objectSpread2({}, {
        answer
      }));
      _export("b", b = "b");
    }
  };
});