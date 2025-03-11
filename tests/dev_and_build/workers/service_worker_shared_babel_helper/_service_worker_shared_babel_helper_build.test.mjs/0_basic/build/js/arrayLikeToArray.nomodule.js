System.register([], function (_export, _context) {
  "use strict";

  function arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    var arr2 = new Array(len);
    for (var i = 0; i < len; i++) arr2[i] = arr[i];
    return arr2;
  }
  _export("default", arrayLikeToArray);
  return {
    setters: [],
    execute: function () {}
  };
});