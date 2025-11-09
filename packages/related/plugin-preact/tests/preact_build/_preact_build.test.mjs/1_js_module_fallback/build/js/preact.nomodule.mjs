System.register([], function (_export, _context) {
  "use strict";

  var n, l, u, t, i, r, f, e, o, c, s, a, h, p, v, y, w;
  function d(n) {
    n && n.parentNode && n.remove();
  }
  function _(n, l, u) {
    var t,
      i,
      r,
      f = {};
    for (r in l) "key" == r ? t = l[r] : "ref" == r && "function" != typeof n ? i = l[r] : f[r] = l[r];
    return arguments.length > 2 && (f.children = arguments.length > 3 ? y.call(arguments, 2) : u), g(n, f, t, i, null);
  }
  function g(u, t, i, r, f) {
    var e = {
      type: u,
      props: t,
      key: i,
      ref: r,
      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __c: null,
      constructor: void 0,
      __v: null == f ? ++l : f,
      __i: -1,
      __u: 0
    };
    return null == f && null != n.vnode && n.vnode(e), e;
  }
  function b() {
    return {
      current: null
    };
  }
  function k(n) {
    return n.children;
  }
  function m(n, l) {
    this.props = n, this.context = l, this.__g = 0;
  }
  function M(n, l) {
    if (null == l) return n.__ ? M(n.__, n.__i + 1) : null;
    for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e;
    return "function" == typeof n.type ? M(n) : null;
  }
  function S(n) {
    var l, u;
    if (null != (n = n.__) && null != n.__c) {
      for (n.__e = null, l = 0; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) {
        n.__e = u.__e;
        break;
      }
      return S(n);
    }
  }
  function $(l) {
    (8 & l.__g || !(l.__g |= 8) || !t.push(l) || r++) && i == n.debounceRendering || ((i = n.debounceRendering) || queueMicrotask)(x);
  }
  function x() {
    for (var l, u, i, e, o, c, s, a, h = 1; t.length;) t.length > h && t.sort(f), l = t.shift(), h = t.length, 8 & l.__g && (i = void 0, o = (e = (u = l).__v).__e, c = [], s = [], (a = u.__P) && ((i = w({}, e)).__v = e.__v + 1, n.vnode && n.vnode(i), q(a, i, e, u.__n, a.namespaceURI, 32 & e.__u ? [o] : null, c, null == o ? M(e) : o, !!(32 & e.__u), s, a.ownerDocument), i.__v = e.__v, i.__.__k[i.__i] = i, P(c, i, s), i.__e != o && S(i)));
    r = 0;
  }
  function C(n, l, u, t, i, r, f, e, o, c, s, a) {
    var v,
      y,
      w,
      d,
      _,
      g,
      b,
      k = t && t.__k || p,
      m = l.length;
    for (o = j(u, l, k, o, m), v = 0; v < m; v++) null != (w = u.__k[v]) && (y = -1 == w.__i ? h : k[w.__i] || h, w.__i = v, g = q(n, w, y, i, r, f, e, o, c, s, a), d = w.__e, w.ref && y.ref != w.ref && (y.ref && B(y.ref, null, w), s.push(w.ref, w.__c || d, w)), null == _ && null != d && (_ = d), (b = !!(4 & w.__u)) || y.__k === w.__k ? o = A(w, o, n, b) : "function" == typeof w.type && void 0 !== g ? o = g : d && (o = d.nextSibling), w.__u &= -7);
    return u.__e = _, o;
  }
  function j(n, l, u, t, i) {
    var r,
      f,
      e,
      o,
      c,
      s = u.length,
      a = s,
      h = 0;
    for (n.__k = new Array(i), r = 0; r < i; r++) null != (f = l[r]) && "boolean" != typeof f && "function" != typeof f ? (o = r + h, (f = n.__k[r] = "string" == typeof f || "number" == typeof f || "bigint" == typeof f || f.constructor == String ? g(null, f, null, null, null) : v(f) ? g(k, {
      children: f
    }, null, null, null) : null == f.constructor && f.__b > 0 ? g(f.type, f.props, f.key, f.ref ? f.ref : null, f.__v) : f).__ = n, f.__b = n.__b + 1, e = null, -1 != (c = f.__i = I(f, u, o, a)) && (a--, (e = u[c]) && (e.__u |= 2)), null == e || null == e.__v ? (-1 == c && (i > s ? h-- : i < s && h++), "function" != typeof f.type && (f.__u |= 4)) : c != o && (c == o - 1 ? h-- : c == o + 1 ? h++ : (c > o ? h-- : h++, f.__u |= 4))) : n.__k[r] = null;
    if (a) for (r = 0; r < s; r++) null != (e = u[r]) && 0 == (2 & e.__u) && (e.__e == t && (t = M(e)), D(e, e));
    return t;
  }
  function A(n, l, u, t) {
    var i, r;
    if ("function" == typeof n.type) {
      for (i = n.__k, r = 0; i && r < i.length; r++) i[r] && (i[r].__ = n, l = A(i[r], l, u, t));
      return l;
    }
    n.__e != l && (t && (l && n.type && !l.parentNode && (l = M(n)), u.insertBefore(n.__e, l || null)), l = n.__e);
    do {
      l = l && l.nextSibling;
    } while (null != l && 8 == l.nodeType);
    return l;
  }
  function H(n, l) {
    return l = l || [], null == n || "boolean" == typeof n || (v(n) ? n.some(function (n) {
      H(n, l);
    }) : l.push(n)), l;
  }
  function I(n, l, u, t) {
    var i,
      r,
      f,
      e = n.key,
      o = n.type,
      c = l[u],
      s = null != c && 0 == (2 & c.__u);
    if (null === c && null == n.key || s && e == c.key && o == c.type) return u;
    if (t > (s ? 1 : 0)) for (i = u - 1, r = u + 1; i >= 0 || r < l.length;) if (null != (c = l[f = i >= 0 ? i-- : r++]) && 0 == (2 & c.__u) && e == c.key && o == c.type) return f;
    return -1;
  }
  function L(n, l, u) {
    "-" == l[0] ? n.setProperty(l, null == u ? "" : u) : n[l] = null == u ? "" : u;
  }
  function O(n, l, u, t, i) {
    var r;
    n: if ("style" == l) {
      if ("string" == typeof u) n.style.cssText = u;else {
        if ("string" == typeof t && (n.style.cssText = t = ""), t) for (l in t) u && l in u || L(n.style, l, "");
        if (u) for (l in u) t && u[l] == t[l] || L(n.style, l, u[l]);
      }
    } else if ("o" == l[0] && "n" == l[1]) r = l != (l = l.replace(e, "$1")), (l = l.slice(2))[0].toLowerCase() != l[0] && (l = l.toLowerCase()), n.__l || (n.__l = {}), n.__l[l + r] = u, u ? t ? u.l = t.l : (u.l = o, n.addEventListener(l, r ? s : c, r)) : n.removeEventListener(l, r ? s : c, r);else {
      if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");else if ("width" != l && "height" != l && "href" != l && "list" != l && "form" != l && "tabIndex" != l && "download" != l && "rowSpan" != l && "colSpan" != l && "role" != l && "popover" != l && l in n) try {
        n[l] = null == u ? "" : u;
        break n;
      } catch (n) {}
      "function" == typeof u || (null == u || !1 === u && "-" != l[4] ? n.removeAttribute(l) : n.setAttribute(l, "popover" == l && 1 == u ? "" : u));
    }
  }
  function T(l) {
    return function (u) {
      if (this.__l) {
        var t = this.__l[u.type + l];
        if (null == u.u) u.u = o++;else if (u.u < t.l) return;
        return t(n.event ? n.event(u) : u);
      }
    };
  }
  function q(l, u, t, i, r, f, e, o, c, s, a) {
    var h,
      p,
      y,
      _,
      g,
      b,
      M,
      S,
      $,
      x,
      j,
      A,
      H,
      I,
      L,
      O,
      T,
      q,
      P,
      B,
      D,
      F = u.type;
    if (null != u.constructor) return null;
    128 & t.__u && (c = !!(32 & t.__u), t.__c.__z && (o = u.__e = t.__e = (f = t.__c.__z)[0], t.__c.__z = null)), (h = n.__b) && h(u);
    n: if ("function" == typeof F) try {
      if (S = u.props, $ = "prototype" in F && F.prototype.render, x = (h = F.contextType) && i[h.__c], j = h ? x ? x.props.value : h.__ : i, t.__c ? 2 & (p = u.__c = t.__c).__g && (p.__g |= 1, M = !0) : ($ ? u.__c = p = new F(S, j) : (u.__c = p = new m(S, j), p.constructor = F, p.render = E), x && x.sub(p), p.props = S, p.state || (p.state = {}), p.context = j, p.__n = i, y = !0, p.__g |= 8, p.__h = [], p._sb = []), $ && null == p.__s && (p.__s = p.state), $ && null != F.getDerivedStateFromProps && (p.__s == p.state && (p.__s = w({}, p.__s)), w(p.__s, F.getDerivedStateFromProps(S, p.__s))), _ = p.props, g = p.state, p.__v = u, y) $ && null == F.getDerivedStateFromProps && null != p.componentWillMount && p.componentWillMount(), $ && null != p.componentDidMount && p.__h.push(p.componentDidMount);else {
        if ($ && null == F.getDerivedStateFromProps && S !== _ && null != p.componentWillReceiveProps && p.componentWillReceiveProps(S, j), !(4 & p.__g) && null != p.shouldComponentUpdate && !1 === p.shouldComponentUpdate(S, p.__s, j) || u.__v == t.__v) {
          for (u.__v != t.__v && (p.props = S, p.state = p.__s, p.__g &= -9), u.__e = t.__e, u.__k = t.__k, u.__k.some(function (n) {
            n && (n.__ = u);
          }), A = 0; A < p._sb.length; A++) p.__h.push(p._sb[A]);
          p._sb = [], p.__h.length && e.push(p);
          break n;
        }
        null != p.componentWillUpdate && p.componentWillUpdate(S, p.__s, j), $ && null != p.componentDidUpdate && p.__h.push(function () {
          p.componentDidUpdate(_, g, b);
        });
      }
      if (p.context = j, p.props = S, p.__P = l, p.__g &= -5, H = n.__r, I = 0, $) {
        for (p.state = p.__s, p.__g &= -9, H && H(u), h = p.render(p.props, p.state, p.context), L = 0; L < p._sb.length; L++) p.__h.push(p._sb[L]);
        p._sb = [];
      } else do {
        p.__g &= -9, H && H(u), h = p.render(p.props, p.state, p.context), p.state = p.__s;
      } while (8 & p.__g && ++I < 25);
      p.state = p.__s, null != p.getChildContext && (i = w({}, i, p.getChildContext())), $ && !y && null != p.getSnapshotBeforeUpdate && (b = p.getSnapshotBeforeUpdate(_, g)), O = h, null != h && h.type === k && null == h.key && (O = V(h.props.children)), o = C(l, v(O) ? O : [O], u, t, i, r, f, e, o, c, s, a), u.__u &= -161, p.__h.length && e.push(p), M && (p.__g &= -4);
    } catch (l) {
      if (u.__v = null, c || null != f) {
        if (l.then) {
          for (T = 0, q = !1, u.__u |= c ? 160 : 128, u.__c.__z = [], P = 0; P < f.length; P++) null == (B = f[P]) || q || (8 == B.nodeType && "$s" == B.data ? (T > 0 && u.__c.__z.push(B), T++, f[P] = null) : 8 == B.nodeType && "/$s" == B.data ? (--T > 0 && u.__c.__z.push(B), q = 0 === T, o = f[P], f[P] = null) : T > 0 && (u.__c.__z.push(B), f[P] = null));
          if (!q) {
            for (; o && 8 == o.nodeType && o.nextSibling;) o = o.nextSibling;
            f[f.indexOf(o)] = null, u.__c.__z = [o];
          }
          u.__e = o;
        } else {
          for (D = f.length; D--;) d(f[D]);
          N(u);
        }
      } else u.__e = t.__e, u.__k = t.__k, l.then || N(u);
      n.__e(l, u, t);
    } else o = u.__e = z(t.__e, u, t, i, r, f, e, c, s, a);
    return (h = n.diffed) && h(u), 128 & u.__u ? void 0 : o;
  }
  function N(n) {
    n && n.__c && (n.__c.__g |= 4), n && n.__k && n.__k.forEach(N);
  }
  function P(l, u, t) {
    for (var i = 0; i < t.length; i++) B(t[i], t[++i], t[++i]);
    n.__c && n.__c(u, l), l.some(function (u) {
      try {
        l = u.__h, u.__h = [], l.some(function (n) {
          n.call(u);
        });
      } catch (l) {
        n.__e(l, u.__v);
      }
    });
  }
  function V(n) {
    return "object" != typeof n || null == n || n.__b && n.__b > 0 ? n : v(n) ? n.map(V) : w({}, n);
  }
  function z(l, u, t, i, r, f, e, o, c, s) {
    var a,
      p,
      w,
      _,
      g,
      b,
      k,
      m,
      S = t.props,
      $ = u.props,
      x = u.type;
    if ("svg" == x ? r = "http://www.w3.org/2000/svg" : "math" == x ? r = "http://www.w3.org/1998/Math/MathML" : r || (r = "http://www.w3.org/1999/xhtml"), null != f) for (a = 0; a < f.length; a++) if ((g = f[a]) && "setAttribute" in g == !!x && (x ? g.localName == x : 3 == g.nodeType)) {
      l = g, f[a] = null;
      break;
    }
    if (null == l) {
      if (null == x) return s.createTextNode($);
      l = s.createElementNS(r, x, $.is && $), o && (n.__m && n.__m(u, f), o = !1), f = null;
    }
    if (null == x) S === $ || o && l.data == $ || (l.data = $);else {
      if (f = f && y.call(l.childNodes), S = t.props || h, !o && null != f) for (S = {}, a = 0; a < l.attributes.length; a++) S[(g = l.attributes[a]).name] = g.value;
      for (a in S) if (g = S[a], "children" == a) ;else if ("dangerouslySetInnerHTML" == a) w = g;else if (!(a in $)) {
        if ("value" == a && "defaultValue" in $ || "checked" == a && "defaultChecked" in $) continue;
        O(l, a, null, g, r);
      }
      for (a in m = 1 & t.__u, $) g = $[a], "children" == a ? _ = g : "dangerouslySetInnerHTML" == a ? p = g : "value" == a ? b = g : "checked" == a ? k = g : o && "function" != typeof g || S[a] === g && !m || O(l, a, g, S[a], r);
      if (p) o || w && (p.__html == w.__html || p.__html == l.innerHTML) || (l.innerHTML = p.__html), u.__k = [];else if (w && (l.innerHTML = ""), C("template" == x ? l.content : l, v(_) ? _ : [_], u, t, i, "foreignObject" == x ? "http://www.w3.org/1999/xhtml" : r, f, e, f ? f[0] : t.__k && M(t, 0), o, c, s), null != f) for (a = f.length; a--;) d(f[a]);
      o || (a = "value", "progress" == x && null == b ? l.removeAttribute("value") : null == b || b === l[a] && ("progress" !== x || b) || O(l, a, b, S[a], r), a = "checked", null != k && k != l[a] && O(l, a, k, S[a], r));
    }
    return l;
  }
  function B(l, u, t) {
    try {
      if ("function" == typeof l) {
        var i = "function" == typeof l.__u;
        i && l.__u(), i && null == u || (l.__u = l(u));
      } else l.current = u;
    } catch (l) {
      n.__e(l, t);
    }
  }
  function D(l, u, t) {
    var i, r;
    if (n.unmount && n.unmount(l), (i = l.ref) && (i.current && i.current != l.__e || B(i, null, u)), null != (i = l.__c)) {
      if (i.componentWillUnmount) try {
        i.componentWillUnmount();
      } catch (l) {
        n.__e(l, u);
      }
      i.__P = null;
    }
    if (i = l.__k) for (r = 0; r < i.length; r++) i[r] && D(i[r], u, t || "function" != typeof l.type);
    t || d(l.__e), l.__e && l.__e.__l && (l.__e.__l = null), l.__e = l.__c = l.__ = null;
  }
  function E(n, l, u) {
    return this.constructor(n, u);
  }
  function F(l, u) {
    var t, i, r, f;
    u == document && (u = document.documentElement), n.__ && n.__(l, u), i = (t = !!(l && 32 & l.__u)) ? null : u.__k, l = u.__k = _(k, null, [l]), r = [], f = [], q(u, l, i || h, h, u.namespaceURI, i ? null : u.firstChild ? y.call(u.childNodes) : null, r, i ? i.__e : u.firstChild, t, f, u.ownerDocument), P(r, l, f);
  }
  function G(n, l) {
    n.__u |= 32, F(n, l);
  }
  function J(n, l, u) {
    var t,
      i,
      r,
      f = w({}, n.props);
    for (r in l) "key" == r ? t = l[r] : "ref" == r && "function" != typeof n.type ? i = l[r] : f[r] = l[r];
    return arguments.length > 2 && (f.children = arguments.length > 3 ? y.call(arguments, 2) : u), g(n.type, f, t || n.key, i || n.ref, null);
  }
  function K(n) {
    function l(n) {
      var u, t;
      return this.getChildContext || (u = new Set(), (t = {})[l.__c] = this, this.getChildContext = function () {
        return t;
      }, this.componentWillUnmount = function () {
        u = null;
      }, this.shouldComponentUpdate = function (n) {
        this.props.value != n.value && u.forEach(function (n) {
          n.__g |= 4, $(n);
        });
      }, this.sub = function (n) {
        u.add(n);
        var l = n.componentWillUnmount;
        n.componentWillUnmount = function () {
          u && u.delete(n), l && l.call(n);
        };
      }), n.children;
    }
    return l.__c = "__cC" + a++, l.__ = n, l.Provider = l.__l = (l.Consumer = function (n, l) {
      return n.children(l);
    }).contextType = l, l;
  }
  _export({
    Component: m,
    Fragment: k,
    cloneElement: J,
    createContext: K,
    createElement: _,
    createRef: b,
    h: _,
    hydrate: G,
    render: F,
    toChildArray: H,
    options: void 0,
    isValidElement: void 0
  });
  return {
    setters: [],
    execute: function () {
      h = {}, p = [], v = Array.isArray, y = p.slice, w = Object.assign;
      _export("options", n = {
        __e: function __e(n, l, u, t) {
          for (var i, f, e; l = l.__;) if ((i = l.__c) && !(1 & i.__g)) {
            i.__g |= 4;
            try {
              if ((f = i.constructor) && null != f.getDerivedStateFromError && (i.setState(f.getDerivedStateFromError(n)), e = 8 & i.__g), null != i.componentDidCatch && (i.componentDidCatch(n, t || {}), e = 8 & i.__g), e) return void (i.__g |= 2);
            } catch (l) {
              n = l;
            }
          }
          throw r = 0, n;
        }
      }), l = 0, _export("isValidElement", u = function u(n) {
        return null != n && null == n.constructor;
      }), m.prototype.setState = function (n, l) {
        var u;
        u = null != this.__s && this.__s != this.state ? this.__s : this.__s = w({}, this.state), "function" == typeof n && (n = n(w({}, u), this.props)), n && w(u, n), null != n && this.__v && (l && this._sb.push(l), $(this));
      }, m.prototype.forceUpdate = function (n) {
        this.__v && (this.__g |= 4, n && this.__h.push(n), $(this));
      }, m.prototype.render = k, t = [], r = 0, f = function f(n, l) {
        return n.__v.__b - l.__v.__b;
      }, e = /(PointerCapture)$|Capture$/i, o = 0, c = T(!1), s = T(!0), a = 0;
    }
  };
});