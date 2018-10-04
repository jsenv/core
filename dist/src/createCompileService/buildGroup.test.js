"use strict";

var _buildGroup = require("./buildGroup.js");

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var root = _path.default.resolve(__dirname, "../../../");

(0, _buildGroup.buildGroup)({
  root: root,
  into: "group.config.json"
});
//# sourceMappingURL=buildGroup.test.js.map