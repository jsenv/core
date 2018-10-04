"use strict";

var _createCompileProfiles = require("./createCompileProfiles.js");

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const root = _path.default.resolve(__dirname, "../../../");

debugger;
(0, _createCompileProfiles.createCompileProfiles)({
  root,
  into: "compile.config.json"
});
//# sourceMappingURL=createCompileProfiles.test.js.map