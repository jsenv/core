"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createBody = void 0;

var _createTwoWayStream = require("./createTwoWayStream.js");

var _pipe = require("./pipe.js");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const stringToArrayBuffer = string => {
  string = String(string);
  const buffer = new ArrayBuffer(string.length * 2); // 2 bytes for each char

  const bufferView = new Uint16Array(buffer);
  let i = 0;

  while (i < string.length) {
    bufferView[i] = string.charCodeAt(i);
    i++;
  }

  return buffer;
};

const createBody = data => {
  const twoWayStream = (0, _createTwoWayStream.createTwoWayStream)();
  (0, _pipe.pipe)(data, twoWayStream);

  const readAsString = () => {
    return twoWayStream.promise.then(buffers => buffers.join(""));
  };

  const text = () => {
    return readAsString();
  };

  const arraybuffer = () => {
    return text().then(stringToArrayBuffer);
  };

  const json = () => {
    return text().then(JSON.parse);
  };

  return _objectSpread({}, twoWayStream, {
    text,
    arraybuffer,
    json
  });
};

exports.createBody = createBody;
//# sourceMappingURL=createBody.js.map