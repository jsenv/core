"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getRemoteLocation = void 0;

var getRemoteLocation = function getRemoteLocation(_ref) {
  var compileURL = _ref.compileURL,
      file = _ref.file;
  return "".concat(compileURL, "/").concat(file);
};

exports.getRemoteLocation = getRemoteLocation;
//# sourceMappingURL=getRemoteLocation.js.map