System.register([__v__("/js/preact.nomodule.mjs")], function (_export, _context) {
  "use strict";

  var r, t, e, o, f, a, c;
  function n(r) {
    if (0 === r.length || !1 === e.test(r)) return r;
    for (var t = 0, n = 0, o = "", f = ""; n < r.length; n++) {
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
      n !== t && (o += r.slice(t, n)), o += f, t = n + 1;
    }
    return n !== t && (o += r.slice(t, n)), o;
  }
  function u(t, e, n, f, u, i) {
    e || (e = {});
    var a,
      c,
      l = e;
    if ("ref" in l && "function" != typeof t) for (c in l = {}, e) "ref" == c ? a = e[c] : l[c] = e[c];
    var p = {
      type: t,
      props: l,
      key: n,
      ref: a,
      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __c: null,
      constructor: void 0,
      __v: --o,
      __i: -1,
      __u: 0,
      __source: u,
      __self: i
    };
    return r.vnode && r.vnode(p), p;
  }
  function i(r) {
    var e = u(t, {
      tpl: r,
      exprs: [].slice.call(arguments, 1)
    });
    return e.key = e.__v, e;
  }
  function l(t, e) {
    if (r.attr) {
      var o = r.attr(t, e);
      if ("string" == typeof o) return o;
    }
    if (e = function (r) {
      return null !== r && "object" == typeof r && "function" == typeof r.valueOf ? r.valueOf() : r;
    }(e), "ref" === t || "key" === t) return "";
    if ("style" === t && "object" == typeof e) {
      var f = "";
      for (var u in e) {
        var i = e[u];
        null != i && "" !== i && (f = f + ("-" == u[0] ? u : a[u] || (a[u] = u.replace(c, "-$&").toLowerCase())) + ":" + i + ";");
      }
      return t + '="' + n(f) + '"';
    }
    return null == e || !1 === e || "function" == typeof e || "object" == typeof e ? "" : !0 === e ? t : t + '="' + n("" + e) + '"';
  }
  function p(r) {
    if (null == r || "boolean" == typeof r || "function" == typeof r) return null;
    if ("object" == typeof r) {
      if (void 0 === r.constructor) return r;
      if (f(r)) {
        for (var t = 0; t < r.length; t++) r[t] = p(r[t]);
        return r;
      }
    }
    return n("" + r);
  }
  _export({
    jsx: u,
    jsxAttr: l,
    jsxDEV: u,
    jsxEscape: p,
    jsxTemplate: i,
    jsxs: u
  });
  return {
    setters: [function (_distPreactMjs) {
      r = _distPreactMjs.options;
      t = _distPreactMjs.Fragment;
      _export("Fragment", _distPreactMjs.Fragment);
    }],
    execute: function () {
      e = /["&<]/;
      o = 0, f = Array.isArray;
      a = {}, c = /[A-Z]/g;
    }
  };
});