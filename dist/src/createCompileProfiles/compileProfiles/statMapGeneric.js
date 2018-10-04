"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.statMapGeneric = void 0;
const statMapGeneric = {
  chrome: {
    "51": 0.6,
    "44": 0.01
  },
  firefox: {
    "53": 0.6,
    "0": 0.1 // it means oldest version of firefox will get a score of 0.1

  },
  edge: {
    "12": 0.1,
    "0": 0.001
  },
  safari: {
    "10": 0.1,
    "0": 0.001
  },
  node: {
    "8": 0.5,
    "0": 0.001
  },
  other: 0.001
};
exports.statMapGeneric = statMapGeneric;
//# sourceMappingURL=statMapGeneric.js.map