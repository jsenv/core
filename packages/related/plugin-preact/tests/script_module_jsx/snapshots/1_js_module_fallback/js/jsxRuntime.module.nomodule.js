System.register([__v__("/js/preact.module.nomodule.js")], function (_export, _context) {
  "use strict";

  var r, e, t, o, f, i, c, p;
  function n(r) {
    if (0 === r.length || !1 === t.test(r)) return r;
    for (var e = 0, n = 0, o = "", f = ""; n < r.length; n++) {
      switch (r.charCodeAt(n)) {
        case 34:
          f = "&quot;";
          break;
        case 38:
          f = "&amp;";
          break;
        case 60:
          f = "&lt;";
          break;
        default:
          continue;
      }
      n !== e && (o += r.slice(e, n)), o += f, e = n + 1;
    }
    return n !== e && (o += r.slice(e, n)), o;
  }
  function u(e, t, n, o, i, u) {
    t || (t = {});
    var a,
      c,
      p = t;
    if ("ref" in p) for (c in p = {}, t) "ref" == c ? a = t[c] : p[c] = t[c];
    var l = {
      type: e,
      props: p,
      key: n,
      ref: a,
      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __d: void 0,
      __c: null,
      constructor: void 0,
      __v: --f,
      __i: -1,
      __u: 0,
      __source: i,
      __self: u
    };
    if ("function" == typeof e && (a = e.defaultProps)) for (c in a) void 0 === p[c] && (p[c] = a[c]);
    return r.vnode && r.vnode(l), l;
  }
  function a(r) {
    var t = u(e, {
      tpl: r,
      exprs: [].slice.call(arguments, 1)
    });
    return t.key = t.__v, t;
  }
  function l(e, t) {
    if (r.attr) {
      var f = r.attr(e, t);
      if ("string" == typeof f) return f;
    }
    if ("ref" === e || "key" === e) return "";
    if ("style" === e && "object" == typeof t) {
      var i = "";
      for (var u in t) {
        var a = t[u];
        if (null != a && "" !== a) {
          var l = "-" == u[0] ? u : c[u] || (c[u] = u.replace(p, "-$&").toLowerCase()),
            _ = ";";
          "number" != typeof a || l.startsWith("--") || o.test(l) || (_ = "px;"), i = i + l + ":" + a + _;
        }
      }
      return e + '="' + i + '"';
    }
    return null == t || !1 === t || "function" == typeof t || "object" == typeof t ? "" : !0 === t ? e : e + '="' + n(t) + '"';
  }
  function _(r) {
    if (null == r || "boolean" == typeof r || "function" == typeof r) return null;
    if ("object" == typeof r) {
      if (void 0 === r.constructor) return r;
      if (i(r)) {
        for (var e = 0; e < r.length; e++) r[e] = _(r[e]);
        return r;
      }
    }
    return n("" + r);
  }
  _export({
    jsx: u,
    jsxAttr: l,
    jsxDEV: u,
    jsxEscape: _,
    jsxTemplate: a,
    jsxs: u
  });
  return {
    setters: [function (_distPreactModuleJs) {
      r = _distPreactModuleJs.options;
      e = _distPreactModuleJs.Fragment;
      _export("Fragment", _distPreactModuleJs.Fragment);
    }],
    execute: function () {
      t = /["&<]/;
      o = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
      f = 0;
      i = Array.isArray;
      c = {};
      p = /[A-Z]/g;
    }
  };
});