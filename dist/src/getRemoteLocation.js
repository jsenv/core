"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getRemoteLocation = void 0;

const getRemoteLocation = ({
  compileURL,
  file
}) => {
  return `${compileURL}/${file}`;
};

exports.getRemoteLocation = getRemoteLocation;
//# sourceMappingURL=getRemoteLocation.js.map