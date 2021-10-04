/* eslint-disable */
;(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? factory(exports)
    : typeof define === "function" && define.amd
    ? define(["exports"], factory)
    : ((global = global || self), factory((global.Carpenter = {})))
})(this, function (exports) {
  "use strict"

  exports.answer = 42

  Object.defineProperty(exports, "__esModule", { value: true })
})
