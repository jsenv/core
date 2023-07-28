System.register([__v__("/js/preact.module.nomodule.js")], function (_export, _context) {
  "use strict";

  var r, _;
  function o(o, e, n, t, f, l) {
    var s,
      u,
      a = {};
    for (u in e) "ref" == u ? s = e[u] : a[u] = e[u];
    var i = {
      type: o,
      props: a,
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
      __v: --_,
      __source: f,
      __self: l
    };
    if ("function" == typeof o && (s = o.defaultProps)) for (u in s) void 0 === a[u] && (a[u] = s[u]);
    return r.vnode && r.vnode(i), i;
  }
  _export({
    jsx: o,
    jsxDEV: o,
    jsxs: o
  });
  return {
    setters: [function (_distPreactModuleJs) {
      r = _distPreactModuleJs.options;
      _export("Fragment", _distPreactModuleJs.Fragment);
    }],
    execute: function () {
      _ = 0;
    }
  };
});