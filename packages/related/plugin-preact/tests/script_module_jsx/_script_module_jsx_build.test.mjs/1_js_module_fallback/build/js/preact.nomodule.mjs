System.register([], function (_export, _context) {
  "use strict";

  var n, t, r, i, f, e, o, u, c, s, a, h, l, p, y, v, _, d, w, b, k, g, m, $, S, x, M;
  function C(n) {
    n && n.parentNode && n.remove();
  }
  function j(n, t, r) {
    var i,
      f,
      e,
      o = {},
      u = arguments.length;
    for (e in t) "key" == e ? i = t[e] : "ref" == e && "function" != typeof n ? f = t[e] : o[e] = t[e];
    return u > 2 && (o.children = u > 3 ? x.call(arguments, 2) : r), I(n, o, i, f, w);
  }
  function H(n, t, r) {
    var i,
      f,
      e,
      o = M({}, n.props),
      u = arguments.length;
    for (e in t) "key" == e ? i = t[e] : "ref" == e && "function" != typeof n.type ? f = t[e] : o[e] = t[e];
    return u > 2 && (o.children = u > 3 ? x.call(arguments, 2) : r), I(n.type, o, i !== b ? i : n.key, f !== b ? f : n.ref, w);
  }
  function I(r, i, f, e, o) {
    var u = {
      type: r,
      props: i,
      key: f,
      ref: e,
      __k: w,
      __: w,
      __b: 0,
      __e: w,
      __c: w,
      constructor: b,
      __v: o || ++t,
      __i: -1,
      __u: 0
    };
    return !o && n.vnode && n.vnode(u), u;
  }
  function L() {
    return {
      current: w
    };
  }
  function A(n) {
    return n.children;
  }
  function E(n, t) {
    this.props = n, this.context = t, this.__g = 0;
  }
  function O(n, t) {
    if (t == w) return n.__ ? O(n.__, n.__i + 1) : w;
    for (var r; t < n.__k.length; t++) if ((r = n.__k[t]) && r.__e) return r.__e;
    return "function" != typeof n.type || n.props.__P ? w : O(n);
  }
  function P(t) {
    var r,
      i = t.__v,
      f = i.__e,
      e = [],
      o = [],
      u = t.__P;
    u && ((r = M({
      constructor: b
    }, i)).__v = i.__v + 1, n.vnode && n.vnode(r), Q(u, r, i, t.__n, u.namespaceURI, i.__u & y ? [f] : w, e, f || O(i), i.__u & y, o), r.__v = i.__v, r.__.__k[r.__i] = r, U(e, r, o), i.__ = i.__e = w, r.__e != f && T(r));
  }
  function T(n) {
    if ((n = n.__) && n.__c && !n.props.__P) return n.__e = w, n.__k.some(function (t) {
      return t && (n.__e = t.__e);
    }), T(n);
  }
  function q(t) {
    (8 & t.__g || !(t.__g |= 8) || !i.push(t) || e++) && f == n.debounceRendering || ((f = n.debounceRendering) || queueMicrotask)(B);
  }
  function B() {
    try {
      for (var n, t = 1; i.length;) i.length > t && i.sort(o), n = i.shift(), t = i.length, 8 & n.__g && P(n);
    } finally {
      i.length = e = 0;
    }
  }
  function N(n, t, r, i, f, e, o, u, c, s, a) {
    var h,
      l,
      p,
      y,
      v,
      _,
      d = i.__k || g,
      m = t.length;
    for (c = V(r, t, d, c, m), h = 0; h < m; h++) (p = r.__k[h]) != w && (l = ~p.__i && d[p.__i] || k, p.__i = h, _ = Q(n, p, l, f, e, o, u, c, s, a), y = p.__e, p.ref && l.ref != p.ref && (l.ref && Y(l.ref, w, p), a.push(p.ref, p.__c || y, p)), v = v || y, 4 & p.__u ? (c = z(p, c, n, !l.__v), l.__e && (l.__e = w)) : "function" == typeof p.type && _ !== b ? c = _ : y && (c = y.nextSibling), p.__u &= -7);
    return r.__e = v, c;
  }
  function V(n, t, r, i, f) {
    var e,
      o,
      u,
      c,
      s,
      a,
      h,
      l,
      p,
      y,
      v = r.length,
      _ = v,
      d = 0,
      k = !1,
      g = n.__k = Array(f);
    for (e = 0; e < f; e++) (o = t[e]) != w && "boolean" != typeof o && "function" != typeof o ? ("object" != typeof o || o.constructor == String ? o = g[e] = I(w, o) : S(o) ? o = g[e] = I(A, {
      children: o
    }) : o.constructor === b && o.__b ? o = g[e] = I(o.type, o.props, o.key, o.ref, o.__v) : g[e] = o, c = e + d, o.__ = n, o.__b = n.__b + 1, s = o.__i = F(o, r, c, _), u = w, ~s && (_--, (u = r[s]) && (u.__u |= 2)), u && u.__v ? (o.__u |= 2, s == c - 1 ? d-- : s == c + 1 ? d++ : s != c && (s > c ? d-- : d++, k = !0)) : (~s || (f > v ? d-- : f < v && d++), "function" != typeof o.type && (o.__u |= 4))) : g[e] = w;
    if (k) {
      for (a = [], h = [], e = 0; e < f; e++) if ((o = g[e]) && 2 & o.__u) {
        for (l = 0, p = a.length; l < p;) a[y = l + p >> 1] < o.__i ? l = y + 1 : p = y;
        a[l] = o.__i, h[e] = l + 1;
      }
      for (d = a.length; e--;) h[e] && (h[e] == d ? d-- : g[e].__u |= 4);
    }
    if (_) for (e = 0; e < v; e++) !(u = r[e]) || 2 & u.__u || (u.__e == i && (i = O(u)), Z(u, u));
    return i;
  }
  function z(n, t, r, i) {
    var f, e;
    if ("function" == typeof n.type) {
      if (n.props.__P) return t;
      if (f = n.__k) for (e = 0; e < f.length; e++) f[e] && (f[e].__ = n, t = z(f[e], t, r, !1));
      return t;
    }
    for (n.__e != t && (t && n.type && !t.parentNode && (t = O(n)), $ && !i && n.__e.parentNode ? r.moveBefore(n.__e, t) : r.insertBefore(n.__e, t || w), t = n.__e); (t = t && t.nextSibling) && 8 == t.nodeType;);
    return t;
  }
  function D(n, t) {
    return t = t || [], n != w && "boolean" != typeof n && (S(n) ? n.some(function (n) {
      D(n, t);
    }) : t.push(n)), t;
  }
  function F(n, t, r, i) {
    var f,
      e,
      o,
      u = n.key,
      c = n.type,
      s = t[r],
      a = s && !(2 & s.__u);
    if (s === w && u == w || a && u == s.key && c == s.type) return r;
    if (i > (a ? 1 : 0)) for (f = r - 1, e = r + 1; f >= 0 || e < t.length;) if ((s = t[o = f >= 0 ? f-- : e++]) && !(2 & s.__u) && u == s.key && c == s.type) return o;
    return -1;
  }
  function G(n, t, r) {
    r == w && (r = ""), "-" == t[0] ? n.setProperty(t, r) : n[t] = r;
  }
  function J(n, t, r, i, f) {
    var e;
    n: if ("style" == t) {
      if ("string" == typeof r) n.style.cssText = r;else {
        if ("string" == typeof i && (n.style.cssText = i = ""), i) for (t in i) r && t in r || G(n.style, t, "");
        if (r) for (t in r) i && r[t] == i[t] || G(n.style, t, r[t]);
      }
    } else if ("o" == t[0] && "n" == t[1]) e = t != (t = t.replace(s, "$1")), t = t.slice(2).toLowerCase(), (n.__e || (n.__e = {}))[t + e] = r, r ? i ? r[c] = i[c] : (r[c] = a, n.addEventListener(t, e ? l : h, e)) : n.removeEventListener(t, e ? l : h, e);else {
      if (f == v) t = t.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");else if ("width" != t && "height" != t && "href" != t && "list" != t && "form" != t && "tabIndex" != t && "download" != t && "rowSpan" != t && "colSpan" != t && "role" != t && "popover" != t && t in n) try {
        n[t] = r == w ? "" : r;
        break n;
      } catch (n) {}
      "function" == typeof r || (r == w || !1 === r && "-" != t[4] ? n.removeAttribute(t) : n.setAttribute(t, "popover" == t && 1 == r ? "" : r));
    }
  }
  function K(t) {
    return function (r) {
      if (this.__e) {
        var i = this.__e[r.type + t];
        if (r[u] == w) r[u] = a++;else if (r[u] < i[c]) return;
        return i(n.event ? n.event(r) : r);
      }
    };
  }
  function Q(t, r, i, f, e, o, u, c, s, a) {
    var h,
      l,
      p,
      v,
      _,
      d,
      k,
      m,
      $,
      x,
      j,
      H,
      I,
      L,
      P,
      T,
      q,
      B,
      V,
      z = r.type;
    if (r.constructor !== b) return w;
    if (128 & i.__u && (s = i.__u & y) && (h = i.__c.__z)) {
      if (r.__u |= y, o = [], 8 == h.nodeType) for (l = 1, p = h.nextSibling; p; p = p.nextSibling) {
        if (8 == p.nodeType) if (p.data.startsWith("$s")) l++;else if (p.data.startsWith("/$s") && ! --l) break;
        o.push(p);
      } else o.push(h);
      c = o[0], i.__c.__z = w;
    }
    (h = n.__b) && h(r);
    n: if ("function" == typeof z) {
      v = u.length;
      try {
        if ($ = r.props, x = (h = z.prototype) && h.render, j = (h = z.contextType) && f[h.__c], H = h ? j ? j.props.value : h.__ : f, i.__c ? 2 & (_ = r.__c = i.__c).__g && (_.__g |= 1) : (x ? r.__c = _ = new z($, H) : (r.__c = _ = new E($, H), _.constructor = z, _.render = nn), j && j.sub(_), _.state || (_.state = {}), _.__n = f, _.__g |= 8, _.__h = [], _.__k = []), x && (_.__s || (_.__s = _.state), z.getDerivedStateFromProps && (_.__s == _.state && (_.__s = M({}, _.__s)), M(_.__s, z.getDerivedStateFromProps($, _.__s)))), d = _.props, k = _.state, _.__v = r, i.__c) {
          if (x && !z.getDerivedStateFromProps && $ !== d && _.componentWillReceiveProps && _.componentWillReceiveProps($, H), r.__v == i.__v && !(8 & _.__g) || !(4 & _.__g) && _.shouldComponentUpdate && !1 === _.shouldComponentUpdate($, _.__s, H)) {
            r.__v != i.__v && (_.props = $, _.state = _.__s, _.__g &= -9), r.__e = i.__e, r.__k = i.__k, r.__k.some(function (n) {
              n && (n.__ = r);
            }), g.push.apply(_.__h, _.__k), _.__k = [], _.__h.length && u.push(_), c = O(i);
            break n;
          }
          _.componentWillUpdate && _.componentWillUpdate($, _.__s, H), x && _.componentDidUpdate && _.__h.push(function () {
            _.componentDidUpdate(d, k, m);
          });
        } else x && !z.getDerivedStateFromProps && _.componentWillMount && _.componentWillMount(), x && _.componentDidMount && _.__h.push(_.componentDidMount);
        if (_.context = H, _.props = $, _.__P = t, _.__g &= -5, I = n.__r, L = 0, x) _.state = _.__s, _.__g &= -9, I && I(r), h = _.render(_.props, _.state, _.context), g.push.apply(_.__h, _.__k), _.__k = [];else do {
          _.__g &= -9, I && I(r), h = _.render(_.props, _.state, _.context), _.state = _.__s;
        } while (8 & _.__g && ++L < 25);
        _.state = _.__s, _.getChildContext && (f = M({}, f, _.getChildContext())), x && i.__c && _.getSnapshotBeforeUpdate && (m = _.getSnapshotBeforeUpdate(d, k)), P = h && h.type === A && h.key == w ? W(h.props.children) : h, $.__P && (h = c, e = (t = $.__P).namespaceURI, i.props && i.props.__P != t && (i.__k.some(function (n) {
          n && Z(n, n);
        }), i.__k = w), c = i.__k ? O(i, 0) : w), c = N(t, S(P) ? P : [P], r, i, f, e, o, u, c, s, a), $.__P && (r.__e = w, c = h), r.__u &= -161, _.__h.length && u.push(_), 1 & _.__g && (_.__g &= -4);
      } catch (t) {
        if (u.length = v, r.__v = w, s || o) {
          if (t.then) {
            if (T = 0, r.__u |= s ? 160 : 128, o) for (B = 0; B < o.length; B++) if (V = o[B]) if (8 == V.nodeType) {
              if (o[B] = w, V.data.startsWith("$s")) T++ || (q = V);else if (V.data.startsWith("/$s") && ! --T) {
                c = V;
                break;
              }
            } else T && (o[B] = w);
            if (!q) {
              for (; c && 8 == c.nodeType && c.nextSibling;) c = c.nextSibling;
              o && (o[o.indexOf(c)] = w), q = c;
            }
            r.__c.__z = q, r.__e = c;
          } else o && o.some(C);
        } else r.__e = i.__e;
        r.__k || (r.__k = i.__k || []), t.then || R(r), n.__e(t, r, i);
      }
    } else c = r.__e = X(i.__e, r, i, f, e, o, u, s, a, t);
    return (h = n.diffed) && h(r), 128 & r.__u ? b : c;
  }
  function R(n) {
    n && (n.__c && (n.__c.__g |= 4), n.__k && n.__k.some(R));
  }
  function U(t, r, i) {
    for (var f = 0; f < i.length;) Y(i[f++], i[f++], i[f++]);
    n.__c && n.__c(r, t), t.some(function (r) {
      try {
        t = r.__h, r.__h = [], t.some(function (n) {
          n.call(r);
        });
      } catch (t) {
        n.__e(t, r.__v);
      }
    });
  }
  function W(n) {
    return "object" != typeof n || n == w || n.__b ? n : S(n) ? n.map(W) : n.constructor !== b ? w : M({
      constructor: b
    }, n);
  }
  function X(t, r, i, f, e, o, u, c, s, a) {
    var h,
      l,
      p,
      y,
      g,
      $,
      M,
      j,
      H,
      I = i.props || k,
      L = r.props,
      A = r.type;
    if ("svg" == A ? e = v : "math" == A ? e = d : e || (e = _), o) for (h = 0; h < o.length; h++) if ((g = o[h]) && (A ? g.localName == A : 3 == g.nodeType)) {
      t = g, o[h] = w;
      break;
    }
    if (!t) {
      if (j = a.ownerDocument, !A) return j.createTextNode(L);
      t = j.createElementNS(e, A, L.is && L), c && (n.__m && n.__m(r, o), c = !1), o = w;
    }
    if (A) {
      if (a = "template" == A ? t.content : t, o = "textarea" == A && L.defaultValue != w ? w : o && x.call(a.childNodes), !c && o) for (I = {}, h = 0; h < t.attributes.length; h++) I[(g = t.attributes[h]).name] = g.value;
      for (h in I) g = I[h], "dangerouslySetInnerHTML" == h ? p = g : "children" == h || h in L || "value" == h && "defaultValue" in L || "checked" == h && "defaultChecked" in L || J(t, h, w, g, e);
      for (h in H = 1 & i.__u, L) g = L[h], "children" == h ? y = g : "dangerouslySetInnerHTML" == h ? l = g : "value" == h ? $ = g : "checked" == h ? M = g : c && "function" != typeof g || !(I[h] !== g || H && g != w) || J(t, h, g, I[h], e);
      l ? (c || p && (l.__html == p.__html || l.__html == t.innerHTML) || (t.innerHTML = l.__html), r.__k = []) : (p && (t.textContent = ""), ("foreignObject" == A || e == d && m.test(A)) && (e = _), N(a, S(y) ? y : [y], r, i, f, e, o, u, o ? o[0] : i.__k && O(i, 0), c, s), o && o.some(C)), c && "textarea" != A || (h = "value", "progress" == A && $ == w ? t.removeAttribute(h) : $ == b || $ === t[h] && ("progress" != A || $) || J(t, h, $, I[h], e), h = "checked", M != b && M != t[h] && J(t, h, M, I[h], e));
    } else I === L || c && t.data == L || (t.data = L);
    return t;
  }
  function Y(t, r, i) {
    try {
      "function" == typeof t ? ("function" == typeof t.__u && t.__u(), ("function" != typeof t.__u || r) && (t.__u = t(r))) : t.current = r;
    } catch (t) {
      n.__e(t, i);
    }
  }
  function Z(t, r, i) {
    var f, e;
    if (n.unmount && n.unmount(t), !(f = t.ref) || f.current && f.current != t.__e || Y(f, w, r), f = t.__c) {
      if (f.componentWillUnmount) try {
        f.componentWillUnmount();
      } catch (t) {
        n.__e(t, r);
      }
      f.__P = f.__n = w;
    }
    if (f = t.__k) for (e = 0; e < f.length; e++) f[e] && Z(f[e], r, "function" != typeof t.type || i && !t.props.__P);
    (f = t.__e) && (i || C(f), f.__e && (f.__e = w)), t.__e = t.__c = t.__ = w;
  }
  function nn(n, t, r) {
    return this.constructor(n, r);
  }
  function tn(t, r) {
    var i, f, e, o;
    n.__ && n.__(t, r), 9 == r.nodeType && (r = r.documentElement), f = (i = t && t.__u & y) ? w : r.__k, r.__k = I(A, {
      children: [t]
    }), e = [], o = [], Q(r, r.__k, f || k, k, r.namespaceURI, f ? w : r.firstChild ? x.call(r.childNodes) : w, e, f ? f.__e : r.firstChild, i, o), U(e, r.__k, o), r.__k.props.children = w;
  }
  function rn(n, t) {
    n.__u |= y, tn(n, t);
  }
  function fn(n) {
    function t(n) {
      var r, i;
      return this.getChildContext || (r = new Set(), (i = {})[t.__c] = this, this.getChildContext = function () {
        return i;
      }, this.shouldComponentUpdate = function (n) {
        this.props.value != n.value && r.forEach(function (n) {
          n.__g |= 4, q(n);
        });
      }, this.sub = function (n) {
        r.add(n);
        var t = n.componentWillUnmount;
        n.componentWillUnmount = function () {
          r.delete(n), t && t.call(n);
        };
      }), n.children;
    }
    return t.__c = "__cC" + p++, t.__ = n, t.Provider = (t.Consumer = function (n, t) {
      return n.children(t);
    }).contextType = t, t;
  }
  function en(n) {
    return n.children;
  }
  function on(n, t) {
    return I(en, {
      __P: t,
      children: n
    });
  }
  _export({
    Component: E,
    Fragment: A,
    cloneElement: H,
    createContext: fn,
    createElement: j,
    createPortal: on,
    createRef: L,
    h: j,
    hydrate: rn,
    render: tn,
    toChildArray: D,
    options: void 0,
    isValidElement: void 0
  });
  return {
    setters: [],
    execute: function () {
      y = 32, v = "http://www.w3.org/2000/svg", _ = "http://www.w3.org/1999/xhtml", d = "http://www.w3.org/1998/Math/MathML", w = null, b = void 0, k = {}, g = [], m = /^m(i|n|o|s|text|space)$/, $ = typeof Element < "u" && "moveBefore" in Element.prototype, S = Array.isArray, x = g.slice, M = Object.assign;
      _export("options", n = {
        __e: function (n, t, r, i) {
          for (var f, o, u; t = t.__;) if ((f = t.__c) && !(1 & f.__g)) {
            f.__g |= 4;
            try {
              if ((o = f.constructor) && o.getDerivedStateFromError && (f.setState(o.getDerivedStateFromError(n)), u = 8 & f.__g), f.componentDidCatch && (f.componentDidCatch(n, i || {}), u = 8 & f.__g), u) return void (f.__g |= 2);
            } catch (t) {
              n = t;
            }
          }
          throw e = 0, n;
        }
      }), t = 0, _export("isValidElement", r = function (n) {
        return n != w && n.constructor === b;
      }), E.prototype.setState = function (n, t) {
        var r = this.__s;
        r && r != this.state || (r = this.__s = M({}, this.state)), "function" == typeof n && (n = n(M({}, r), this.props)), n && (M(r, n), this.__v && (t && this.__k.push(t), q(this)));
      }, E.prototype.forceUpdate = function (n) {
        this.__v && (this.__g |= 4, n && this.__h.push(n), q(this));
      }, E.prototype.render = A, i = [], e = 0, o = function (n, t) {
        return n.__v.__b - t.__v.__b;
      }, u = Symbol(), c = Symbol(), s = /(PointerCapture)$|Capture$/i, a = 0, h = K(!1), l = K(!0), p = 0;
    }
  };
});