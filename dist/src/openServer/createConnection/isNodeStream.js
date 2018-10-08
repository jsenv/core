"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isNodeStream = void 0;

var _stream = _interopRequireDefault(require("stream"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const isNodeStream = a => {
  if (a === undefined) return false;

  if (a instanceof _stream.default.Stream || a instanceof _stream.default.Writable) {
    return true;
  }

  return false;
};

exports.isNodeStream = isNodeStream;
//# sourceMappingURL=isNodeStream.js.map