System.register([], function (_export, _context) {
  "use strict";

  var n, l, u, t, i, r, o, f, e, c, s, h, a, p, v, y, w, d;
  function g(n) {
    n && n.parentNode && n.remove();
  }
  function _(n, l, u) {
    var t,
      i,
      r,
      o = {};
    for (r in l) "key" == r ? t = l[r] : "ref" == r && "function" != typeof n ? i = l[r] : o[r] = l[r];
    return arguments.length > 2 && (o.children = arguments.length > 3 ? w.call(arguments, 2) : u), m(n, o, t, i, null);
  }
  function m(u, t, i, r, o) {
    var f = {
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
      __v: null == o ? ++l : o,
      __i: -1,
      __u: 0
    };
    return null == o && null != n.vnode && n.vnode(f), f;
  }
  function b() {
    return {
      current: null
    };
  }
  function k(n) {
    return n.children;
  }
  function M(n, l) {
    this.props = n, this.context = l, this.__g = 0;
  }
  function $(n, l) {
    if (null == l) return n.__ ? $(n.__, n.__i + 1) : null;
    for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e;
    return "function" == typeof n.type ? $(n) : null;
  }
  function S(n) {
    if (null != (n = n.__) && null != n.__c) return n.__e = null, n.__k.some(function (l) {
      if (null != l && null != l.__e) return n.__e = l.__e;
    }), S(n);
  }
  function x(l) {
    (8 & l.__g || !(l.__g |= 8) || !t.push(l) || r++) && i == n.debounceRendering || ((i = n.debounceRendering) || queueMicrotask)(C);
  }
  function C() {
    for (var l, u, i, f, e, c, s, h, a = 1; t.length;) t.length > a && t.sort(o), l = t.shift(), a = t.length, 8 & l.__g && (i = void 0, f = void 0, e = (f = (u = l).__v).__e, c = [], s = [], (h = u.__P) && ((i = d({}, f)).__v = f.__v + 1, n.vnode && n.vnode(i), N(h, i, f, u.__n, h.namespaceURI, 32 & f.__u ? [e] : null, c, null == e ? $(f) : e, !!(32 & f.__u), s, h.ownerDocument), i.__v = f.__v, i.__.__k[i.__i] = i, V(c, i, s), f.__ = f.__e = null, i.__e != e && S(i)));
    r = 0;
  }
  function L(n, l, u, t, i, r, o, f, e, c, s, h) {
    var v,
      y,
      w,
      d,
      g,
      _,
      m,
      b = t && t.__k || p,
      k = l.length;
    for (e = j(u, l, b, e, k), v = 0; v < k; v++) null != (w = u.__k[v]) && (y = -1 != w.__i && b[w.__i] || a, w.__i = v, _ = N(n, w, y, i, r, o, f, e, c, s, h), d = w.__e, w.ref && y.ref != w.ref && (y.ref && D(y.ref, null, w), s.push(w.ref, w.__c || d, w)), null == g && null != d && (g = d), (m = 4 & w.__u) || y.__k === w.__k ? e = A(w, e, n, m) : "function" == typeof w.type && void 0 !== _ ? e = _ : d && (e = d.nextSibling), w.__u &= -7);
    return u.__e = g, e;
  }
  function j(n, l, u, t, i) {
    var r,
      o,
      f,
      e,
      c,
      s = u.length,
      h = s,
      a = 0;
    for (n.__k = new Array(i), r = 0; r < i; r++) null != (o = l[r]) && "boolean" != typeof o && "function" != typeof o ? ("string" == typeof o || "number" == typeof o || "bigint" == typeof o || o.constructor == String ? o = n.__k[r] = m(null, o, null, null, null) : y(o) ? o = n.__k[r] = m(k, {
      children: o
    }, null, null, null) : void 0 === o.constructor && o.__b > 0 ? o = n.__k[r] = m(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v) : n.__k[r] = o, e = r + a, o.__ = n, o.__b = n.__b + 1, f = null, -1 != (c = o.__i = I(o, u, e, h)) && (h--, (f = u[c]) && (f.__u |= 2)), null == f || null == f.__v ? (-1 == c && (i > s ? a-- : i < s && a++), "function" != typeof o.type && (o.__u |= 4)) : c != e && (c == e - 1 ? a-- : c == e + 1 ? a++ : (c > e ? a-- : a++, o.__u |= 4))) : n.__k[r] = null;
    if (h) for (r = 0; r < s; r++) null != (f = u[r]) && 0 == (2 & f.__u) && (f.__e == t && (t = $(f)), E(f, f));
    return t;
  }
  function A(n, l, u, t) {
    var i, r;
    if ("function" == typeof n.type) {
      for (i = n.__k, r = 0; i && r < i.length; r++) i[r] && (i[r].__ = n, l = A(i[r], l, u, t));
      return l;
    }
    n.__e != l && (t && (l && n.type && !l.parentNode && (l = $(n)), u.insertBefore(n.__e, l || null)), l = n.__e);
    do {
      l = l && l.nextSibling;
    } while (null != l && 8 == l.nodeType);
    return l;
  }
  function H(n, l) {
    return l = l || [], null == n || "boolean" == typeof n || (y(n) ? n.some(function (n) {
      H(n, l);
    }) : l.push(n)), l;
  }
  function I(n, l, u, t) {
    var i,
      r,
      o,
      f = n.key,
      e = n.type,
      c = l[u],
      s = null != c && 0 == (2 & c.__u);
    if (null === c && null == f || s && f == c.key && e == c.type) return u;
    if (t > (s ? 1 : 0)) for (i = u - 1, r = u + 1; i >= 0 || r < l.length;) if (null != (c = l[o = i >= 0 ? i-- : r++]) && 0 == (2 & c.__u) && f == c.key && e == c.type) return o;
    return -1;
  }
  function O(n, l, u) {
    "-" == l[0] ? n.setProperty(l, null == u ? "" : u) : n[l] = null == u ? "" : u;
  }
  function T(n, l, u, t, i) {
    var r;
    n: if ("style" == l) {
      if ("string" == typeof u) n.style.cssText = u;else {
        if ("string" == typeof t && (n.style.cssText = t = ""), t) for (l in t) u && l in u || O(n.style, l, "");
        if (u) for (l in u) t && u[l] == t[l] || O(n.style, l, u[l]);
      }
    } else if ("o" == l[0] && "n" == l[1]) r = l != (l = l.replace(f, "$1")), l = l.slice(2).toLowerCase(), n.__l || (n.__l = {}), n.__l[l + r] = u, u ? t ? u.l = t.l : (u.l = e, n.addEventListener(l, r ? s : c, r)) : n.removeEventListener(l, r ? s : c, r);else {
      if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");else if ("width" != l && "height" != l && "href" != l && "list" != l && "form" != l && "tabIndex" != l && "download" != l && "rowSpan" != l && "colSpan" != l && "role" != l && "popover" != l && l in n) try {
        n[l] = null == u ? "" : u;
        break n;
      } catch (n) {}
      "function" == typeof u || (null == u || !1 === u && "-" != l[4] ? n.removeAttribute(l) : n.setAttribute(l, "popover" == l && 1 == u ? "" : u));
    }
  }
  function q(l) {
    return function (u) {
      if (this.__l) {
        var t = this.__l[u.type + l];
        if (null == u.u) u.u = e++;else if (u.u < t.l) return;
        return t(n.event ? n.event(u) : u);
      }
    };
  }
  function N(l, u, t, i, r, o, f, e, c, s, h) {
    var a,
      p,
      v,
      w,
      _,
      m,
      b,
      $,
      S,
      x,
      C,
      j,
      A,
      H,
      I,
      O,
      T,
      q,
      N,
      V = u.type;
    if (void 0 !== u.constructor) return null;
    128 & t.__u && (c = 32 & t.__u) && t.__c.__z && (e = (o = t.__c.__z)[0], t.__c.__z = null), (a = n.__b) && a(u);
    n: if ("function" == typeof V) try {
      if (m = u.props, b = "prototype" in V && V.prototype.render, $ = (a = V.contextType) && i[a.__c], S = a ? $ ? $.props.value : a.__ : i, t.__c ? 2 & (p = u.__c = t.__c).__g && (p.__g |= 1) : (b ? u.__c = p = new V(m, S) : (u.__c = p = new M(m, S), p.constructor = V, p.render = F), $ && $.sub(p), p.state || (p.state = {}), p.__n = i, p.__g |= 8, p.__h = [], p._sb = []), b && null == p.__s && (p.__s = p.state), b && null != V.getDerivedStateFromProps && (p.__s == p.state && (p.__s = d({}, p.__s)), d(p.__s, V.getDerivedStateFromProps(m, p.__s))), v = p.props, w = p.state, p.__v = u, t.__c) {
        if (b && null == V.getDerivedStateFromProps && m !== v && null != p.componentWillReceiveProps && p.componentWillReceiveProps(m, S), u.__v == t.__v || !(4 & p.__g) && null != p.shouldComponentUpdate && !1 === p.shouldComponentUpdate(m, p.__s, S)) {
          u.__v != t.__v && (p.props = m, p.state = p.__s, p.__g &= -9), u.__e = t.__e, u.__k = t.__k, u.__k.some(function (n) {
            n && (n.__ = u);
          }), (x = p.__h).push.apply(x, p._sb), p._sb = [], p.__h.length && f.push(p);
          break n;
        }
        null != p.componentWillUpdate && p.componentWillUpdate(m, p.__s, S), b && null != p.componentDidUpdate && p.__h.push(function () {
          p.componentDidUpdate(v, w, _);
        });
      } else b && null == V.getDerivedStateFromProps && null != p.componentWillMount && p.componentWillMount(), b && null != p.componentDidMount && p.__h.push(p.componentDidMount);
      if (p.context = S, p.props = m, p.__P = l, p.__g &= -5, C = n.__r, j = 0, b) p.state = p.__s, p.__g &= -9, C && C(u), a = p.render(p.props, p.state, p.context), (A = p.__h).push.apply(A, p._sb), p._sb = [];else do {
        p.__g &= -9, C && C(u), a = p.render(p.props, p.state, p.context), p.state = p.__s;
      } while (8 & p.__g && ++j < 25);
      p.state = p.__s, null != p.getChildContext && (i = d({}, i, p.getChildContext())), b && t.__c && null != p.getSnapshotBeforeUpdate && (_ = p.getSnapshotBeforeUpdate(v, w)), H = null != a && a.type === k && null == a.key ? z(a.props.children) : a, e = L(l, y(H) ? H : [H], u, t, i, r, o, f, e, c, s, h), u.__u &= -161, p.__h.length && f.push(p), 2 & p.__g && (p.__g &= -4);
    } catch (l) {
      if (u.__v = null, c || null != o) {
        if (l.then) {
          for (I = 0, u.__u |= c ? 160 : 128, u.__c.__z = [], T = 0; T < o.length; T++) null == (q = o[T]) || O || (8 == q.nodeType ? ("$s" == q.data ? (I && u.__c.__z.push(q), I++) : "/$s" == q.data && (--I && u.__c.__z.push(q), O = 0 == I, e = o[T]), o[T] = null) : I && (u.__c.__z.push(q), o[T] = null));
          if (!O) {
            for (; e && 8 == e.nodeType && e.nextSibling;) e = e.nextSibling;
            o[o.indexOf(e)] = null, u.__c.__z = [e];
          }
          u.__e = e;
        } else {
          for (N = o.length; N--;) g(o[N]);
          P(u);
        }
      } else u.__e = t.__e, u.__k = t.__k, l.then || P(u);
      n.__e(l, u, t);
    } else e = u.__e = B(t.__e, u, t, i, r, o, f, c, s, h);
    return (a = n.diffed) && a(u), 128 & u.__u ? void 0 : e;
  }
  function P(n) {
    n && n.__c && (n.__c.__g |= 4), n && n.__k && n.__k.forEach(P);
  }
  function V(l, u, t) {
    for (var i = 0; i < t.length; i++) D(t[i], t[++i], t[++i]);
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
  function z(n) {
    return "object" != typeof n || null == n || n.__b > 0 ? n : y(n) ? n.map(z) : d({}, n);
  }
  function B(l, u, t, i, r, o, f, e, c, s) {
    var h,
      p,
      d,
      _,
      m,
      b,
      k,
      M,
      S = t.props || a,
      x = u.props,
      C = u.type;
    if ("svg" == C ? r = "http://www.w3.org/2000/svg" : "math" == C ? r = "http://www.w3.org/1998/Math/MathML" : r || (r = "http://www.w3.org/1999/xhtml"), null != o) for (h = 0; h < o.length; h++) if ((m = o[h]) && "setAttribute" in m == !!C && (C ? m.localName == C : 3 == m.nodeType)) {
      l = m, o[h] = null;
      break;
    }
    if (null == l) {
      if (null == C) return s.createTextNode(x);
      l = s.createElementNS(r, C, x.is && x), e && (n.__m && n.__m(u, o), e = !1), o = null;
    }
    if (null == C) S === x || e && l.data == x || (l.data = x);else {
      if (o = o && w.call(l.childNodes), !e && null != o) for (S = {}, h = 0; h < l.attributes.length; h++) S[(m = l.attributes[h]).name] = m.value;
      for (h in S) m = S[h], "dangerouslySetInnerHTML" == h ? d = m : "children" == h || h in x || "value" == h && "defaultValue" in x || "checked" == h && "defaultChecked" in x || T(l, h, null, m, r);
      for (h in M = 1 & t.__u, x) m = x[h], "children" == h ? _ = m : "dangerouslySetInnerHTML" == h ? p = m : "value" == h ? b = m : "checked" == h ? k = m : e && "function" != typeof m || S[h] === m && !M || T(l, h, m, S[h], r);
      if (p) e || d && (p.__html == d.__html || p.__html == l.innerHTML) || (l.innerHTML = p.__html), u.__k = [];else if (d && (l.innerHTML = ""), ("foreignObject" == C || "http://www.w3.org/1998/Math/MathML" == r && v.test(C)) && (r = "http://www.w3.org/1999/xhtml"), L("template" == C ? l.content : l, y(_) ? _ : [_], u, t, i, r, o, f, o ? o[0] : t.__k && $(t, 0), e, c, s), null != o) for (h = o.length; h--;) g(o[h]);
      e || (h = "value", "progress" == C && null == b ? l.removeAttribute("value") : null == b || b === l[h] && ("progress" !== C || b) || T(l, h, b, S[h], r), h = "checked", null != k && k != l[h] && T(l, h, k, S[h], r));
    }
    return l;
  }
  function D(l, u, t) {
    try {
      "function" == typeof l ? ("function" == typeof l.__u && l.__u(), "function" == typeof l.__u && null == u || (l.__u = l(u))) : l.current = u;
    } catch (l) {
      n.__e(l, t);
    }
  }
  function E(l, u, t) {
    var i, r;
    if (n.unmount && n.unmount(l), !(i = l.ref) || i.current && i.current != l.__e || D(i, null, u), null != (i = l.__c)) {
      if (i.componentWillUnmount) try {
        i.componentWillUnmount();
      } catch (l) {
        n.__e(l, u);
      }
      i.__P = null;
    }
    if (i = l.__k) for (r = 0; r < i.length; r++) i[r] && E(i[r], u, t || "function" != typeof l.type);
    t || g(l.__e), l.__e && l.__e.__l && (l.__e.__l = null), l.__e = l.__c = l.__ = null;
  }
  function F(n, l, u) {
    return this.constructor(n, u);
  }
  function G(l, u) {
    var t, i, r, o;
    u == document && (u = document.documentElement), n.__ && n.__(l, u), i = (t = l && 32 & l.__u) ? null : u.__k, u.__k = _(k, null, [l]), r = [], o = [], N(u, u.__k, i || a, a, u.namespaceURI, i ? null : u.firstChild ? w.call(u.childNodes) : null, r, i ? i.__e : u.firstChild, t, o, u.ownerDocument), V(r, u.__k, o);
  }
  function J(n, l) {
    n.__u |= 32, G(n, l);
  }
  function K(n, l, u) {
    var t,
      i,
      r,
      o = d({}, n.props);
    for (r in l) "key" == r ? t = l[r] : "ref" == r && "function" != typeof n.type ? i = l[r] : o[r] = l[r];
    return arguments.length > 2 && (o.children = arguments.length > 3 ? w.call(arguments, 2) : u), m(n.type, o, t || n.key, i || n.ref, null);
  }
  function Q(n) {
    function l(n) {
      var u, t;
      return this.getChildContext || (u = new Set(), (t = {})[l.__c] = this, this.getChildContext = function () {
        return t;
      }, this.componentWillUnmount = function () {
        u = null;
      }, this.shouldComponentUpdate = function (n) {
        this.props.value != n.value && u.forEach(function (n) {
          n.__g |= 4, x(n);
        });
      }, this.sub = function (n) {
        u.add(n);
        var l = n.componentWillUnmount;
        n.componentWillUnmount = function () {
          u && u.delete(n), l && l.call(n);
        };
      }), n.children;
    }
    return l.__c = "__cC" + h++, l.__ = n, l.Provider = l.__l = (l.Consumer = function (n, l) {
      return n.children(l);
    }).contextType = l, l;
  }
  _export({
    Component: M,
    Fragment: k,
    cloneElement: K,
    createContext: Q,
    createElement: _,
    createRef: b,
    h: _,
    hydrate: J,
    render: G,
    toChildArray: H,
    options: void 0,
    isValidElement: void 0
  });
  return {
    setters: [],
    execute: function () {
      a = {}, p = [], v = /(mi|mn|mo|ms$|mte|msp)/, y = Array.isArray, w = p.slice, d = Object.assign;
      _export("options", n = {
        __e: function (n, l, u, t) {
          for (var i, o, f; l = l.__;) if ((i = l.__c) && !(1 & i.__g)) {
            i.__g |= 4;
            try {
              if ((o = i.constructor) && null != o.getDerivedStateFromError && (i.setState(o.getDerivedStateFromError(n)), f = 8 & i.__g), null != i.componentDidCatch && (i.componentDidCatch(n, t || {}), f = 8 & i.__g), f) return void (i.__g |= 2);
            } catch (l) {
              n = l;
            }
          }
          throw r = 0, n;
        }
      }), l = 0, _export("isValidElement", u = function (n) {
        return null != n && void 0 === n.constructor;
      }), M.prototype.setState = function (n, l) {
        var u;
        u = null != this.__s && this.__s != this.state ? this.__s : this.__s = d({}, this.state), "function" == typeof n && (n = n(d({}, u), this.props)), n && (d(u, n), this.__v && (l && this._sb.push(l), x(this)));
      }, M.prototype.forceUpdate = function (n) {
        this.__v && (this.__g |= 4, n && this.__h.push(n), x(this));
      }, M.prototype.render = k, t = [], r = 0, o = function (n, l) {
        return n.__v.__b - l.__v.__b;
      }, f = /(PointerCapture)$|Capture$/i, e = 0, c = q(!1), s = q(!0), h = 0;
    }
  };
});