System.register([__v__("/js/preact.module.nomodule.js")], function (_export, _context) {
  "use strict";

  var _, r;
  function o(o, e, n, t, f, l) {
    var s,
      i,
      u = {};
    for (i in e) "ref" == i ? s = e[i] : u[i] = e[i];
    var a = {
      type: o,
      props: u,
      key: n,
      ref: s,
      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __d: void 0,
      __c: null,
      __h: null,
      constructor: void 0,
      __v: --r,
      __i: -1,
      __source: f,
      __self: l
    };
    if ("function" == typeof o && (s = o.defaultProps)) for (i in s) void 0 === u[i] && (u[i] = s[i]);
    return _.vnode && _.vnode(a), a;
  }
  _export({
    jsx: o,
    jsxDEV: o,
    jsxs: o
  });
  return {
    setters: [function (_distPreactModuleJs) {
      _ = _distPreactModuleJs.options;
      _export("Fragment", _distPreactModuleJs.Fragment);
    }],
    execute: function () {
      r = 0;
    }
  };
});