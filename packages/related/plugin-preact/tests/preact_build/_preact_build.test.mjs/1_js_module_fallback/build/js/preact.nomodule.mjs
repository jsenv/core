System.register([], function (_export, _context) {
  "use strict";

  var n, l, u, t, i, r, f, e, o, c, s, a, h, p, v, y, w, d, g, _;
  function b(n) {
    n && n.parentNode && n.remove();
  }
  function m(n, l, u) {
    var t,
      i,
      r,
      f = {};
    for (r in l) "key" == r ? t = l[r] : "ref" == r && "function" != typeof n ? i = l[r] : f[r] = l[r];
    return arguments.length > 2 && (f.children = arguments.length > 3 ? g.call(arguments, 2) : u), k(n, f, t, i, null);
  }
  function k(u, t, i, r, f) {
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
  function M() {
    return {
      current: null
    };
  }
  function $(n) {
    return n.children;
  }
  function S(n, l) {
    this.props = n, this.context = l, this.__g = 0;
  }
  function x(n, l) {
    if (null == l) return n.__ ? x(n.__, n.__i + 1) : null;
    for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e;
    return "function" == typeof n.type ? x(n) : null;
  }
  function C(n) {
    if (null != (n = n.__) && null != n.__c) return n.__e = null, n.__k.some(function (l) {
      if (null != l && null != l.__e) return n.__e = l.__e;
    }), C(n);
  }
  function L(l) {
    (8 & l.__g || !(l.__g |= 8) || !t.push(l) || r++) && i == n.debounceRendering || ((i = n.debounceRendering) || queueMicrotask)(j);
  }
  function j() {
    var l, u, i, e, o, c, s, a, h;
    try {
      for (u = 1; t.length;) t.length > u && t.sort(f), l = t.shift(), u = t.length, 8 & l.__g && (e = void 0, o = void 0, c = (o = (i = l).__v).__e, s = [], a = [], (h = i.__P) && ((e = _({}, o)).__v = o.__v + 1, n.vnode && n.vnode(e), V(h, e, o, i.__n, h.namespaceURI, 32 & o.__u ? [c] : null, s, null == c ? x(o) : c, !!(32 & o.__u), a, h.ownerDocument), e.__v = o.__v, e.__.__k[e.__i] = e, B(s, e, a), o.__ = o.__e = null, e.__e != c && C(e)));
    } finally {
      t.length = r = 0;
    }
  }
  function A(n, l, u, t, i, r, f, e, o, c, s, a) {
    var h,
      p,
      w,
      d,
      g,
      _,
      b,
      m = t && t.__k || y,
      k = l.length;
    for (o = H(u, l, m, o, k), h = 0; h < k; h++) null != (w = u.__k[h]) && (p = -1 != w.__i && m[w.__i] || v, w.__i = h, _ = V(n, w, p, i, r, f, e, o, c, s, a), d = w.__e, w.ref && p.ref != w.ref && (p.ref && F(p.ref, null, w), s.push(w.ref, w.__c || d, w)), null == g && null != d && (g = d), (b = 4 & w.__u) || p.__k === w.__k ? (o = I(w, o, n, b), b && p.__e && (p.__e = null)) : "function" == typeof w.type && void 0 !== _ ? o = _ : d && (o = d.nextSibling), w.__u &= -7);
    return u.__e = g, o;
  }
  function H(n, l, u, t, i) {
    var r,
      f,
      e,
      o,
      c,
      s = u.length,
      a = s,
      h = 0;
    for (n.__k = new Array(i), r = 0; r < i; r++) null != (f = l[r]) && "boolean" != typeof f && "function" != typeof f ? ("string" == typeof f || "number" == typeof f || "bigint" == typeof f || f.constructor == String ? f = n.__k[r] = k(null, f, null, null, null) : d(f) ? f = n.__k[r] = k($, {
      children: f
    }, null, null, null) : void 0 === f.constructor && f.__b > 0 ? f = n.__k[r] = k(f.type, f.props, f.key, f.ref ? f.ref : null, f.__v) : n.__k[r] = f, o = r + h, f.__ = n, f.__b = n.__b + 1, e = null, -1 != (c = f.__i = T(f, u, o, a)) && (a--, (e = u[c]) && (e.__u |= 2)), null == e || null == e.__v ? (-1 == c && (i > s ? h-- : i < s && h++), "function" != typeof f.type && (f.__u |= 4)) : c != o && (c == o - 1 ? h-- : c == o + 1 ? h++ : (c > o ? h-- : h++, f.__u |= 4))) : n.__k[r] = null;
    if (a) for (r = 0; r < s; r++) null != (e = u[r]) && 0 == (2 & e.__u) && (e.__e == t && (t = x(e)), G(e, e));
    return t;
  }
  function I(n, l, u, t) {
    var i, r;
    if ("function" == typeof n.type) {
      for (i = n.__k, r = 0; i && r < i.length; r++) i[r] && (i[r].__ = n, l = I(i[r], l, u, t));
      return l;
    }
    n.__e != l && (t && (l && n.type && !l.parentNode && (l = x(n)), u.insertBefore(n.__e, l || null)), l = n.__e);
    do {
      l = l && l.nextSibling;
    } while (null != l && 8 == l.nodeType);
    return l;
  }
  function O(n, l) {
    return l = l || [], null == n || "boolean" == typeof n || (d(n) ? n.some(function (n) {
      O(n, l);
    }) : l.push(n)), l;
  }
  function T(n, l, u, t) {
    var i,
      r,
      f,
      e = n.key,
      o = n.type,
      c = l[u],
      s = null != c && 0 == (2 & c.__u);
    if (null === c && null == e || s && e == c.key && o == c.type) return u;
    if (t > (s ? 1 : 0)) for (i = u - 1, r = u + 1; i >= 0 || r < l.length;) if (null != (c = l[f = i >= 0 ? i-- : r++]) && 0 == (2 & c.__u) && e == c.key && o == c.type) return f;
    return -1;
  }
  function q(n, l, u) {
    "-" == l[0] ? n.setProperty(l, null == u ? "" : u) : n[l] = null == u ? "" : u;
  }
  function N(n, l, u, t, i) {
    var r;
    n: if ("style" == l) {
      if ("string" == typeof u) n.style.cssText = u;else {
        if ("string" == typeof t && (n.style.cssText = t = ""), t) for (l in t) u && l in u || q(n.style, l, "");
        if (u) for (l in u) t && u[l] == t[l] || q(n.style, l, u[l]);
      }
    } else if ("o" == l[0] && "n" == l[1]) r = l != (l = l.replace(c, "$1")), l = l.slice(2).toLowerCase(), n.__l || (n.__l = {}), n.__l[l + r] = u, u ? t ? u[o] = t[o] : (u[o] = s, n.addEventListener(l, r ? h : a, r)) : n.removeEventListener(l, r ? h : a, r);else {
      if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");else if ("width" != l && "height" != l && "href" != l && "list" != l && "form" != l && "tabIndex" != l && "download" != l && "rowSpan" != l && "colSpan" != l && "role" != l && "popover" != l && l in n) try {
        n[l] = null == u ? "" : u;
        break n;
      } catch (n) {}
      "function" == typeof u || (null == u || !1 === u && "-" != l[4] ? n.removeAttribute(l) : n.setAttribute(l, "popover" == l && 1 == u ? "" : u));
    }
  }
  function P(l) {
    return function (u) {
      if (this.__l) {
        var t = this.__l[u.type + l];
        if (null == u[e]) u[e] = s++;else if (u[e] < t[o]) return;
        return t(n.event ? n.event(u) : u);
      }
    };
  }
  function V(l, u, t, i, r, f, e, o, c, s, a) {
    var h,
      p,
      v,
      w,
      g,
      m,
      k,
      M,
      x,
      C,
      L,
      j,
      H,
      I,
      O,
      T,
      q,
      N,
      P,
      V,
      B,
      F = u.type;
    if (void 0 !== u.constructor) return null;
    if (128 & t.__u && (c = 32 & t.__u) && t.__c.__z) {
      if (f = [], 8 == (p = t.__c.__z).nodeType) for (v = 1, w = p.nextSibling; w && v > 0; w = w.nextSibling) {
        if (8 == w.nodeType) if (w.data.startsWith("$s")) v++;else if (w.data.startsWith("/$s") && ! --v) break;
        f.push(w);
      } else f.push(p);
      o = f[0], t.__c.__z = null;
    }
    (h = n.__b) && h(u);
    n: if ("function" == typeof F) {
      g = e.length;
      try {
        if (C = u.props, L = F.prototype && F.prototype.render, j = (h = F.contextType) && i[h.__c], H = h ? j ? j.props.value : h.__ : i, t.__c ? 2 & (m = u.__c = t.__c).__g && (m.__g |= 1) : (L ? u.__c = m = new F(C, H) : (u.__c = m = new S(C, H), m.constructor = F, m.render = J), j && j.sub(m), m.state || (m.state = {}), m.__n = i, m.__g |= 8, m.__h = [], m._sb = []), L && null == m.__s && (m.__s = m.state), L && null != F.getDerivedStateFromProps && (m.__s == m.state && (m.__s = _({}, m.__s)), _(m.__s, F.getDerivedStateFromProps(C, m.__s))), k = m.props, M = m.state, m.__v = u, t.__c) {
          if (L && null == F.getDerivedStateFromProps && C !== k && null != m.componentWillReceiveProps && m.componentWillReceiveProps(C, H), u.__v == t.__v || !(4 & m.__g) && null != m.shouldComponentUpdate && !1 === m.shouldComponentUpdate(C, m.__s, H)) {
            u.__v != t.__v && (m.props = C, m.state = m.__s, m.__g &= -9), u.__e = t.__e, u.__k = t.__k, u.__k.some(function (n) {
              n && (n.__ = u);
            }), y.push.apply(m.__h, m._sb), m._sb = [], m.__h.length && e.push(m);
            break n;
          }
          null != m.componentWillUpdate && m.componentWillUpdate(C, m.__s, H), L && null != m.componentDidUpdate && m.__h.push(function () {
            m.componentDidUpdate(k, M, x);
          });
        } else L && null == F.getDerivedStateFromProps && null != m.componentWillMount && m.componentWillMount(), L && null != m.componentDidMount && m.__h.push(m.componentDidMount);
        if (m.context = H, m.props = C, m.__P = l, m.__g &= -5, I = n.__r, O = 0, L) m.state = m.__s, m.__g &= -9, I && I(u), h = m.render(m.props, m.state, m.context), y.push.apply(m.__h, m._sb), m._sb = [];else do {
          m.__g &= -9, I && I(u), h = m.render(m.props, m.state, m.context), m.state = m.__s;
        } while (8 & m.__g && ++O < 25);
        m.state = m.__s, null != m.getChildContext && (i = _({}, i, m.getChildContext())), L && t.__c && null != m.getSnapshotBeforeUpdate && (x = m.getSnapshotBeforeUpdate(k, M)), T = null != h && h.type === $ && null == h.key ? D(h.props.children) : h, o = A(l, d(T) ? T : [T], u, t, i, r, f, e, o, c, s, a), u.__u &= -161, m.__h.length && e.push(m), 2 & m.__g && (m.__g &= -4);
      } catch (l) {
        if (e.length = g, u.__v = null, c || null != f) {
          if (l.then) {
            if (q = 0, u.__u |= c ? 160 : 128, null != f) for (P = 0; P < f.length; P++) if (null != (V = f[P])) if (8 == V.nodeType) {
              if (V.data.startsWith("$s")) q || (N = V), q++;else if (V.data.startsWith("/$s") && 0 == --q) {
                o = V, f[P] = null;
                break;
              }
              f[P] = null;
            } else q && (f[P] = null);
            if (N) u.__c.__z = N;else {
              for (; o && 8 == o.nodeType && o.nextSibling;) o = o.nextSibling;
              null != f && (f[f.indexOf(o)] = null), u.__c.__z = o;
            }
            u.__e = o;
          } else if (null != f) for (B = f.length; B--;) b(f[B]);
        } else u.__e = t.__e;
        null == u.__k && (u.__k = t.__k || []), l.then || z(u), n.__e(l, u, t);
      }
    } else o = u.__e = E(t.__e, u, t, i, r, f, e, c, s, a);
    return (h = n.diffed) && h(u), 128 & u.__u ? void 0 : o;
  }
  function z(n) {
    n && n.__c && (n.__c.__g |= 4), n && n.__k && n.__k.forEach(z);
  }
  function B(l, u, t) {
    for (var i = 0; i < t.length; i++) F(t[i], t[++i], t[++i]);
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
  function D(n) {
    return "object" != typeof n || null == n || n.__b > 0 ? n : d(n) ? n.map(D) : void 0 !== n.constructor ? null : _({}, n);
  }
  function E(l, u, t, i, r, f, e, o, c, s) {
    var a,
      h,
      p,
      y,
      _,
      m,
      k,
      M,
      $ = t.props || v,
      S = u.props,
      C = u.type;
    if ("svg" == C ? r = "http://www.w3.org/2000/svg" : "math" == C ? r = "http://www.w3.org/1998/Math/MathML" : r || (r = "http://www.w3.org/1999/xhtml"), null != f) for (a = 0; a < f.length; a++) if ((_ = f[a]) && "setAttribute" in _ == !!C && (C ? _.localName == C : 3 == _.nodeType)) {
      l = _, f[a] = null;
      break;
    }
    if (null == l) {
      if (null == C) return s.createTextNode(S);
      l = s.createElementNS(r, C, S.is && S), o && (n.__m && n.__m(u, f), o = !1), f = null;
    }
    if (null == C) $ === S || o && l.data == S || (l.data = S);else {
      if (f = "textarea" == C && null != S.defaultValue ? null : f && g.call(l.childNodes), !o && null != f) for ($ = {}, a = 0; a < l.attributes.length; a++) $[(_ = l.attributes[a]).name] = _.value;
      for (a in $) _ = $[a], "dangerouslySetInnerHTML" == a ? p = _ : "children" == a || a in S || "value" == a && "defaultValue" in S || "checked" == a && "defaultChecked" in S || N(l, a, null, _, r);
      for (a in M = 1 & t.__u, S) _ = S[a], "children" == a ? y = _ : "dangerouslySetInnerHTML" == a ? h = _ : "value" == a ? m = _ : "checked" == a ? k = _ : o && "function" != typeof _ || !($[a] !== _ || M && null != _) || N(l, a, _, $[a], r);
      if (h) o || p && (h.__html == p.__html || h.__html == l.innerHTML) || (l.innerHTML = h.__html), u.__k = [];else if (p && (l.innerHTML = ""), ("foreignObject" == C || "http://www.w3.org/1998/Math/MathML" == r && w.test(C)) && (r = "http://www.w3.org/1999/xhtml"), A("template" == C ? l.content : l, d(y) ? y : [y], u, t, i, r, f, e, f ? f[0] : t.__k && x(t, 0), o, c, s), null != f) for (a = f.length; a--;) b(f[a]);
      o && "textarea" != C || (a = "value", "progress" == C && null == m ? l.removeAttribute("value") : null == m || m === l[a] && ("progress" !== C || m) || N(l, a, m, $[a], r), a = "checked", null != k && k != l[a] && N(l, a, k, $[a], r));
    }
    return l;
  }
  function F(l, u, t) {
    try {
      "function" == typeof l ? ("function" == typeof l.__u && l.__u(), "function" == typeof l.__u && null == u || (l.__u = l(u))) : l.current = u;
    } catch (l) {
      n.__e(l, t);
    }
  }
  function G(l, u, t) {
    var i, r;
    if (n.unmount && n.unmount(l), !(i = l.ref) || i.current && i.current != l.__e || F(i, null, u), null != (i = l.__c)) {
      if (i.componentWillUnmount) try {
        i.componentWillUnmount();
      } catch (l) {
        n.__e(l, u);
      }
      i.__P = i.__n = null;
    }
    if (i = l.__k) for (r = 0; r < i.length; r++) i[r] && G(i[r], u, t || "function" != typeof l.type);
    t || b(l.__e), l.__e && l.__e.__l && (l.__e.__l = null), l.__e = l.__c = l.__ = null;
  }
  function J(n, l, u) {
    return this.constructor(n, u);
  }
  function K(l, u) {
    var t, i, r, f;
    n.__ && n.__(l, u), 9 == u.nodeType && (u = u.documentElement), i = (t = l && 32 & l.__u) ? null : u.__k, u.__k = m($, null, [l]), r = [], f = [], V(u, u.__k, i || v, v, u.namespaceURI, i ? null : u.firstChild ? g.call(u.childNodes) : null, r, i ? i.__e : u.firstChild, t, f, u.ownerDocument), B(r, u.__k, f), u.__k.props.children = null;
  }
  function Q(n, l) {
    n.__u |= 32, K(n, l);
  }
  function R(n, l, u) {
    var t,
      i,
      r,
      f = _({}, n.props);
    for (r in l) "key" == r ? t = l[r] : "ref" == r && "function" != typeof n.type ? i = l[r] : f[r] = l[r];
    return arguments.length > 2 && (f.children = arguments.length > 3 ? g.call(arguments, 2) : u), k(n.type, f, void 0 !== t ? t : n.key, void 0 !== i ? i : n.ref, null);
  }
  function U(n) {
    function l(n) {
      var u, t;
      return this.getChildContext || (u = new Set(), (t = {})[l.__c] = this, this.getChildContext = function () {
        return t;
      }, this.componentWillUnmount = function () {
        u = null;
      }, this.shouldComponentUpdate = function (n) {
        this.props.value != n.value && u.forEach(function (n) {
          n.__g |= 4, L(n);
        });
      }, this.sub = function (n) {
        u.add(n);
        var l = n.componentWillUnmount;
        n.componentWillUnmount = function () {
          u && u.delete(n), l && l.call(n);
        };
      }), n.children;
    }
    return l.__c = "__cC" + p++, l.__ = n, l.Provider = l.__l = (l.Consumer = function (n, l) {
      return n.children(l);
    }).contextType = l, l;
  }
  _export({
    Component: S,
    Fragment: $,
    cloneElement: R,
    createContext: U,
    createElement: m,
    createRef: M,
    h: m,
    hydrate: Q,
    render: K,
    toChildArray: O,
    options: void 0,
    isValidElement: void 0
  });
  return {
    setters: [],
    execute: function () {
      v = {}, y = [], w = /(mi|mn|mo|ms$|mte|msp)/, d = Array.isArray, g = y.slice, _ = Object.assign;
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
        return null != n && void 0 === n.constructor;
      }), S.prototype.setState = function (n, l) {
        var u;
        u = null != this.__s && this.__s != this.state ? this.__s : this.__s = _({}, this.state), "function" == typeof n && (n = n(_({}, u), this.props)), n && (_(u, n), this.__v && (l && this._sb.push(l), L(this)));
      }, S.prototype.forceUpdate = function (n) {
        this.__v && (this.__g |= 4, n && this.__h.push(n), L(this));
      }, S.prototype.render = $, t = [], r = 0, f = function f(n, l) {
        return n.__v.__b - l.__v.__b;
      }, e = Symbol(), o = Symbol(), c = /(PointerCapture)$|Capture$/i, s = 0, a = P(!1), h = P(!0), p = 0;
    }
  };
});