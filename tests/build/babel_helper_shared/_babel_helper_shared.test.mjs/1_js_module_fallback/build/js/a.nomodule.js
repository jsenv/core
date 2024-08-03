System.register([__v__("/js/objectSpread2.nomodule.js"), __v__("/js/main.nomodule.js")], function (_export, _context) {
  "use strict";

  var _objectSpread2, _slicedToArray, getResponse, _getResponse, _getResponse2, answer, a;
  return {
    setters: [function (_objectSpread2Js) {
      _objectSpread2 = _objectSpread2Js._objectSpread2;
    }, function (_mainJs) {
      _slicedToArray = _mainJs._slicedToArray;
    }],
    execute: function () {
      getResponse = () => {
        return [42];
      };
      _getResponse = getResponse();
      _getResponse2 = _slicedToArray(_getResponse, 1);
      answer = _getResponse2[0];
      console.log(_objectSpread2({}, {
        answer
      }));
      _export("a", a = "a");
    }
  };
});