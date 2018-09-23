"use strict";

var _watchFile = require("./watchFile.js");

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

process.stdin.resume();
var file = _path2["default"].resolve(__dirname, "../../") + "/src/watchFile.js";
(0, _watchFile.watchFile)(file, function (param) {
  console.log("file changed", param);
});
//# sourceMappingURL=watchFile.test.js.map