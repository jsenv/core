"use strict";

var _watchFile = require("./watchFile.js");

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

process.stdin.resume();
var file = "".concat(_path.default.resolve(__dirname, "../../"), "/src/watchFile.js");
(0, _watchFile.watchFile)(file, function (param) {
  console.log("file changed", param);
});
//# sourceMappingURL=watchFile.test.js.map