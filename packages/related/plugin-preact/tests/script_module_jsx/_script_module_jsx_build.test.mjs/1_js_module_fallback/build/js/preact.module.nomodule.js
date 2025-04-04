System.register([], function (_export, _context) {
  "use strict";

  var n, l, t, u, i, r, o, e, f, c, s, a, h, p, v, y, d;
  function w(n, l) {
    for (var t in l) n[t] = l[t];
    return n;
  }
  function g(n) {
    n && n.parentNode && n.parentNode.removeChild(n);
  }
  function _(l, t, u) {
    var i,
      r,
      o,
      e = {};
    for (o in t) "key" == o ? i = t[o] : "ref" == o ? r = t[o] : e[o] = t[o];
    if (arguments.length > 2 && (e.children = arguments.length > 3 ? n.call(arguments, 2) : u), "function" == typeof l && null != l.defaultProps) for (o in l.defaultProps) void 0 === e[o] && (e[o] = l.defaultProps[o]);
    return m(l, e, i, r, null);
  }
  function m(n, u, i, r, o) {
    var e = {
      type: n,
      props: u,
      key: i,
      ref: r,
      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __c: null,
      constructor: void 0,
      __v: null == o ? ++t : o,
      __i: -1,
      __u: 0
    };
    return null == o && null != l.vnode && l.vnode(e), e;
  }
  function b() {
    return {
      current: null
    };
  }
  function k(n) {
    return n.children;
  }
  function x(n, l) {
    this.props = n, this.context = l;
  }
  function S(n, l) {
    if (null == l) return n.__ ? S(n.__, n.__i + 1) : null;
    for (var t; l < n.__k.length; l++) if (null != (t = n.__k[l]) && null != t.__e) return t.__e;
    return "function" == typeof n.type ? S(n) : null;
  }
  function C(n) {
    var l, t;
    if (null != (n = n.__) && null != n.__c) {
      for (n.__e = n.__c.base = null, l = 0; l < n.__k.length; l++) if (null != (t = n.__k[l]) && null != t.__e) {
        n.__e = n.__c.base = t.__e;
        break;
      }
      return C(n);
    }
  }
  function M(n) {
    (!n.__d && (n.__d = !0) && i.push(n) && !$.__r++ || r !== l.debounceRendering) && ((r = l.debounceRendering) || o)($);
  }
  function $() {
    for (var n, t, u, r, o, f, c, s = 1; i.length;) i.length > s && i.sort(e), n = i.shift(), s = i.length, n.__d && (u = void 0, o = (r = (t = n).__v).__e, f = [], c = [], t.__P && ((u = w({}, r)).__v = r.__v + 1, l.vnode && l.vnode(u), O(t.__P, u, r, t.__n, t.__P.namespaceURI, 32 & r.__u ? [o] : null, f, null == o ? S(r) : o, !!(32 & r.__u), c), u.__v = r.__v, u.__.__k[u.__i] = u, z(f, u, c), u.__e != o && C(u)));
    $.__r = 0;
  }
  function I(n, l, t, u, i, r, o, e, f, c, s) {
    var a,
      h,
      y,
      d,
      w,
      g,
      _ = u && u.__k || v,
      m = l.length;
    for (f = P(t, l, _, f, m), a = 0; a < m; a++) null != (y = t.__k[a]) && (h = -1 === y.__i ? p : _[y.__i] || p, y.__i = a, g = O(n, y, h, i, r, o, e, f, c, s), d = y.__e, y.ref && h.ref != y.ref && (h.ref && q(h.ref, null, y), s.push(y.ref, y.__c || d, y)), null == w && null != d && (w = d), 4 & y.__u || h.__k === y.__k ? f = A(y, f, n) : "function" == typeof y.type && void 0 !== g ? f = g : d && (f = d.nextSibling), y.__u &= -7);
    return t.__e = w, f;
  }
  function P(n, l, t, u, i) {
    var r,
      o,
      e,
      f,
      c,
      s = t.length,
      a = s,
      h = 0;
    for (n.__k = new Array(i), r = 0; r < i; r++) null != (o = l[r]) && "boolean" != typeof o && "function" != typeof o ? (f = r + h, (o = n.__k[r] = "string" == typeof o || "number" == typeof o || "bigint" == typeof o || o.constructor == String ? m(null, o, null, null, null) : d(o) ? m(k, {
      children: o
    }, null, null, null) : void 0 === o.constructor && o.__b > 0 ? m(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v) : o).__ = n, o.__b = n.__b + 1, e = null, -1 !== (c = o.__i = L(o, t, f, a)) && (a--, (e = t[c]) && (e.__u |= 2)), null == e || null === e.__v ? (-1 == c && (i > s ? h-- : i < s && h++), "function" != typeof o.type && (o.__u |= 4)) : c != f && (c == f - 1 ? h-- : c == f + 1 ? h++ : (c > f ? h-- : h++, o.__u |= 4))) : n.__k[r] = null;
    if (a) for (r = 0; r < s; r++) null != (e = t[r]) && 0 == (2 & e.__u) && (e.__e == u && (u = S(e)), B(e, e));
    return u;
  }
  function A(n, l, t) {
    var u, i;
    if ("function" == typeof n.type) {
      for (u = n.__k, i = 0; u && i < u.length; i++) u[i] && (u[i].__ = n, l = A(u[i], l, t));
      return l;
    }
    n.__e != l && (l && n.type && !t.contains(l) && (l = S(n)), t.insertBefore(n.__e, l || null), l = n.__e);
    do {
      l = l && l.nextSibling;
    } while (null != l && 8 == l.nodeType);
    return l;
  }
  function H(n, l) {
    return l = l || [], null == n || "boolean" == typeof n || (d(n) ? n.some(function (n) {
      H(n, l);
    }) : l.push(n)), l;
  }
  function L(n, l, t, u) {
    var i,
      r,
      o = n.key,
      e = n.type,
      f = l[t];
    if (null === f && null == n.key || f && o == f.key && e === f.type && 0 == (2 & f.__u)) return t;
    if (u > (null != f && 0 == (2 & f.__u) ? 1 : 0)) for (i = t - 1, r = t + 1; i >= 0 || r < l.length;) {
      if (i >= 0) {
        if ((f = l[i]) && 0 == (2 & f.__u) && o == f.key && e === f.type) return i;
        i--;
      }
      if (r < l.length) {
        if ((f = l[r]) && 0 == (2 & f.__u) && o == f.key && e === f.type) return r;
        r++;
      }
    }
    return -1;
  }
  function T(n, l, t) {
    "-" == l[0] ? n.setProperty(l, null == t ? "" : t) : n[l] = null == t ? "" : "number" != typeof t || y.test(l) ? t : t + "px";
  }
  function j(n, l, t, u, i) {
    var r;
    n: if ("style" == l) {
      if ("string" == typeof t) n.style.cssText = t;else {
        if ("string" == typeof u && (n.style.cssText = u = ""), u) for (l in u) t && l in t || T(n.style, l, "");
        if (t) for (l in t) u && t[l] === u[l] || T(n.style, l, t[l]);
      }
    } else if ("o" == l[0] && "n" == l[1]) r = l != (l = l.replace(f, "$1")), l = l.toLowerCase() in n || "onFocusOut" == l || "onFocusIn" == l ? l.toLowerCase().slice(2) : l.slice(2), n.l || (n.l = {}), n.l[l + r] = t, t ? u ? t.t = u.t : (t.t = c, n.addEventListener(l, r ? a : s, r)) : n.removeEventListener(l, r ? a : s, r);else {
      if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");else if ("width" != l && "height" != l && "href" != l && "list" != l && "form" != l && "tabIndex" != l && "download" != l && "rowSpan" != l && "colSpan" != l && "role" != l && "popover" != l && l in n) try {
        n[l] = null == t ? "" : t;
        break n;
      } catch (n) {}
      "function" == typeof t || (null == t || !1 === t && "-" != l[4] ? n.removeAttribute(l) : n.setAttribute(l, "popover" == l && 1 == t ? "" : t));
    }
  }
  function F(n) {
    return function (t) {
      if (this.l) {
        var u = this.l[t.type + n];
        if (null == t.u) t.u = c++;else if (t.u < u.t) return;
        return u(l.event ? l.event(t) : t);
      }
    };
  }
  function O(n, t, u, i, r, o, e, f, c, s) {
    var a,
      h,
      p,
      v,
      y,
      _,
      m,
      b,
      S,
      C,
      M,
      $,
      P,
      A,
      H,
      L,
      T,
      j = t.type;
    if (void 0 !== t.constructor) return null;
    128 & u.__u && (c = !!(32 & u.__u), o = [f = t.__e = u.__e]), (a = l.__b) && a(t);
    n: if ("function" == typeof j) try {
      if (b = t.props, S = "prototype" in j && j.prototype.render, C = (a = j.contextType) && i[a.__c], M = a ? C ? C.props.value : a.__ : i, u.__c ? m = (h = t.__c = u.__c).__ = h.__E : (S ? t.__c = h = new j(b, M) : (t.__c = h = new x(b, M), h.constructor = j, h.render = D), C && C.sub(h), h.props = b, h.state || (h.state = {}), h.context = M, h.__n = i, p = h.__d = !0, h.__h = [], h._sb = []), S && null == h.__s && (h.__s = h.state), S && null != j.getDerivedStateFromProps && (h.__s == h.state && (h.__s = w({}, h.__s)), w(h.__s, j.getDerivedStateFromProps(b, h.__s))), v = h.props, y = h.state, h.__v = t, p) S && null == j.getDerivedStateFromProps && null != h.componentWillMount && h.componentWillMount(), S && null != h.componentDidMount && h.__h.push(h.componentDidMount);else {
        if (S && null == j.getDerivedStateFromProps && b !== v && null != h.componentWillReceiveProps && h.componentWillReceiveProps(b, M), !h.__e && (null != h.shouldComponentUpdate && !1 === h.shouldComponentUpdate(b, h.__s, M) || t.__v == u.__v)) {
          for (t.__v != u.__v && (h.props = b, h.state = h.__s, h.__d = !1), t.__e = u.__e, t.__k = u.__k, t.__k.some(function (n) {
            n && (n.__ = t);
          }), $ = 0; $ < h._sb.length; $++) h.__h.push(h._sb[$]);
          h._sb = [], h.__h.length && e.push(h);
          break n;
        }
        null != h.componentWillUpdate && h.componentWillUpdate(b, h.__s, M), S && null != h.componentDidUpdate && h.__h.push(function () {
          h.componentDidUpdate(v, y, _);
        });
      }
      if (h.context = M, h.props = b, h.__P = n, h.__e = !1, P = l.__r, A = 0, S) {
        for (h.state = h.__s, h.__d = !1, P && P(t), a = h.render(h.props, h.state, h.context), H = 0; H < h._sb.length; H++) h.__h.push(h._sb[H]);
        h._sb = [];
      } else do {
        h.__d = !1, P && P(t), a = h.render(h.props, h.state, h.context), h.state = h.__s;
      } while (h.__d && ++A < 25);
      h.state = h.__s, null != h.getChildContext && (i = w(w({}, i), h.getChildContext())), S && !p && null != h.getSnapshotBeforeUpdate && (_ = h.getSnapshotBeforeUpdate(v, y)), L = a, null != a && a.type === k && null == a.key && (L = N(a.props.children)), f = I(n, d(L) ? L : [L], t, u, i, r, o, e, f, c, s), h.base = t.__e, t.__u &= -161, h.__h.length && e.push(h), m && (h.__E = h.__ = null);
    } catch (n) {
      if (t.__v = null, c || null != o) {
        if (n.then) {
          for (t.__u |= c ? 160 : 128; f && 8 == f.nodeType && f.nextSibling;) f = f.nextSibling;
          o[o.indexOf(f)] = null, t.__e = f;
        } else for (T = o.length; T--;) g(o[T]);
      } else t.__e = u.__e, t.__k = u.__k;
      l.__e(n, t, u);
    } else null == o && t.__v == u.__v ? (t.__k = u.__k, t.__e = u.__e) : f = t.__e = V(u.__e, t, u, i, r, o, e, c, s);
    return (a = l.diffed) && a(t), 128 & t.__u ? void 0 : f;
  }
  function z(n, t, u) {
    for (var i = 0; i < u.length; i++) q(u[i], u[++i], u[++i]);
    l.__c && l.__c(t, n), n.some(function (t) {
      try {
        n = t.__h, t.__h = [], n.some(function (n) {
          n.call(t);
        });
      } catch (n) {
        l.__e(n, t.__v);
      }
    });
  }
  function N(n) {
    return "object" != typeof n || null == n ? n : d(n) ? n.map(N) : w({}, n);
  }
  function V(t, u, i, r, o, e, f, c, s) {
    var a,
      h,
      v,
      y,
      w,
      _,
      m,
      b = i.props,
      k = u.props,
      x = u.type;
    if ("svg" == x ? o = "http://www.w3.org/2000/svg" : "math" == x ? o = "http://www.w3.org/1998/Math/MathML" : o || (o = "http://www.w3.org/1999/xhtml"), null != e) for (a = 0; a < e.length; a++) if ((w = e[a]) && "setAttribute" in w == !!x && (x ? w.localName == x : 3 == w.nodeType)) {
      t = w, e[a] = null;
      break;
    }
    if (null == t) {
      if (null == x) return document.createTextNode(k);
      t = document.createElementNS(o, x, k.is && k), c && (l.__m && l.__m(u, e), c = !1), e = null;
    }
    if (null === x) b === k || c && t.data === k || (t.data = k);else {
      if (e = e && n.call(t.childNodes), b = i.props || p, !c && null != e) for (b = {}, a = 0; a < t.attributes.length; a++) b[(w = t.attributes[a]).name] = w.value;
      for (a in b) if (w = b[a], "children" == a) ;else if ("dangerouslySetInnerHTML" == a) v = w;else if (!(a in k)) {
        if ("value" == a && "defaultValue" in k || "checked" == a && "defaultChecked" in k) continue;
        j(t, a, null, w, o);
      }
      for (a in k) w = k[a], "children" == a ? y = w : "dangerouslySetInnerHTML" == a ? h = w : "value" == a ? _ = w : "checked" == a ? m = w : c && "function" != typeof w || b[a] === w || j(t, a, w, b[a], o);
      if (h) c || v && (h.__html === v.__html || h.__html === t.innerHTML) || (t.innerHTML = h.__html), u.__k = [];else if (v && (t.innerHTML = ""), I("template" === u.type ? t.content : t, d(y) ? y : [y], u, i, r, "foreignObject" == x ? "http://www.w3.org/1999/xhtml" : o, e, f, e ? e[0] : i.__k && S(i, 0), c, s), null != e) for (a = e.length; a--;) g(e[a]);
      c || (a = "value", "progress" == x && null == _ ? t.removeAttribute("value") : void 0 !== _ && (_ !== t[a] || "progress" == x && !_ || "option" == x && _ !== b[a]) && j(t, a, _, b[a], o), a = "checked", void 0 !== m && m !== t[a] && j(t, a, m, b[a], o));
    }
    return t;
  }
  function q(n, t, u) {
    try {
      if ("function" == typeof n) {
        var i = "function" == typeof n.__u;
        i && n.__u(), i && null == t || (n.__u = n(t));
      } else n.current = t;
    } catch (n) {
      l.__e(n, u);
    }
  }
  function B(n, t, u) {
    var i, r;
    if (l.unmount && l.unmount(n), (i = n.ref) && (i.current && i.current !== n.__e || q(i, null, t)), null != (i = n.__c)) {
      if (i.componentWillUnmount) try {
        i.componentWillUnmount();
      } catch (n) {
        l.__e(n, t);
      }
      i.base = i.__P = null;
    }
    if (i = n.__k) for (r = 0; r < i.length; r++) i[r] && B(i[r], t, u || "function" != typeof n.type);
    u || g(n.__e), n.__c = n.__ = n.__e = void 0;
  }
  function D(n, l, t) {
    return this.constructor(n, t);
  }
  function E(t, u, i) {
    var r, o, e, f;
    u == document && (u = document.documentElement), l.__ && l.__(t, u), o = (r = "function" == typeof i) ? null : i && i.__k || u.__k, e = [], f = [], O(u, t = (!r && i || u).__k = _(k, null, [t]), o || p, p, u.namespaceURI, !r && i ? [i] : o ? null : u.firstChild ? n.call(u.childNodes) : null, e, !r && i ? i : o ? o.__e : u.firstChild, r, f), z(e, t, f);
  }
  function G(n, l) {
    E(n, l, G);
  }
  function J(l, t, u) {
    var i,
      r,
      o,
      e,
      f = w({}, l.props);
    for (o in l.type && l.type.defaultProps && (e = l.type.defaultProps), t) "key" == o ? i = t[o] : "ref" == o ? r = t[o] : f[o] = void 0 === t[o] && void 0 !== e ? e[o] : t[o];
    return arguments.length > 2 && (f.children = arguments.length > 3 ? n.call(arguments, 2) : u), m(l.type, f, i || l.key, r || l.ref, null);
  }
  function K(n) {
    function l(n) {
      var t, u;
      return this.getChildContext || (t = new Set(), (u = {})[l.__c] = this, this.getChildContext = function () {
        return u;
      }, this.componentWillUnmount = function () {
        t = null;
      }, this.shouldComponentUpdate = function (n) {
        this.props.value !== n.value && t.forEach(function (n) {
          n.__e = !0, M(n);
        });
      }, this.sub = function (n) {
        t.add(n);
        var l = n.componentWillUnmount;
        n.componentWillUnmount = function () {
          t && t.delete(n), l && l.call(n);
        };
      }), n.children;
    }
    return l.__c = "__cC" + h++, l.__ = n, l.Provider = l.__l = (l.Consumer = function (n, l) {
      return n.children(l);
    }).contextType = l, l;
  }
  _export({
    Component: x,
    Fragment: k,
    cloneElement: J,
    createContext: K,
    createElement: _,
    createRef: b,
    h: _,
    hydrate: G,
    render: E,
    toChildArray: H,
    options: void 0,
    isValidElement: void 0
  });
  return {
    setters: [],
    execute: function () {
      p = {}, v = [], y = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i, d = Array.isArray;
      n = v.slice, _export("options", l = {
        __e: function (n, l, t, u) {
          for (var i, r, o; l = l.__;) if ((i = l.__c) && !i.__) try {
            if ((r = i.constructor) && null != r.getDerivedStateFromError && (i.setState(r.getDerivedStateFromError(n)), o = i.__d), null != i.componentDidCatch && (i.componentDidCatch(n, u || {}), o = i.__d), o) return i.__E = i;
          } catch (l) {
            n = l;
          }
          throw n;
        }
      }), t = 0, _export("isValidElement", u = function (n) {
        return null != n && null == n.constructor;
      }), x.prototype.setState = function (n, l) {
        var t;
        t = null != this.__s && this.__s !== this.state ? this.__s : this.__s = w({}, this.state), "function" == typeof n && (n = n(w({}, t), this.props)), n && w(t, n), null != n && this.__v && (l && this._sb.push(l), M(this));
      }, x.prototype.forceUpdate = function (n) {
        this.__v && (this.__e = !0, n && this.__h.push(n), M(this));
      }, x.prototype.render = k, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function (n, l) {
        return n.__v.__b - l.__v.__b;
      }, $.__r = 0, f = /(PointerCapture)$|Capture$/i, c = 0, s = F(!1), a = F(!0), h = 0;
    }
  };
});