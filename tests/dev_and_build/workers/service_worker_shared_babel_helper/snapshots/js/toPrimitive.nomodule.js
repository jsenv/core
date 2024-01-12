System.register([], function (_export, _context) {
  "use strict";

  function toPrimitive(input, hint) {
    if (typeof input !== "object" || !input) return input;
    // @ts-expect-error Symbol.toPrimitive might not index {}
    var prim = input[Symbol.toPrimitive];
    if (prim !== undefined) {
      var res = prim.call(input, hint || "default");
      if (typeof res !== "object") return res;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
  }
  _export("default", toPrimitive);
  return {
    setters: [],
    execute: function () {}
  };
});