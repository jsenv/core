System.register([__v__("/js/preact.nomodule.mjs")], function (_export, _context) {
  "use strict";

  var n, t, r, u, i, o, f, c, e, a, v, l, m, s, p, k;
  function d(n, t) {
    e.__h && e.__h(r, n, f || t), f = 0;
    var u = r.__H || (r.__H = {
      __: [],
      __h: []
    });
    return n >= u.__.length && u.__.push({}), u.__[n];
  }
  function h(n) {
    return f = 1, y(D, n);
  }
  function y(n, u, i) {
    var f = d(t++, 2);
    if (f.t = n, !f.__c && (f.__ = [i ? i(u) : D(void 0, u), function (n) {
      var t = f.__N ? f.__N[0] : f.__[0],
        r = f.t(t, n);
      o(t, r) || (f.__N = [r, f.__[1]], f.__c.setState({}));
    }], f.__c = r, !r.__f)) {
      var c = function (n, t, r) {
        if (!f.__c.__H) return !0;
        var u = f.__c.__H.__.filter(function (n) {
          return !!n.__c;
        });
        if (u.every(function (n) {
          return !n.__N;
        })) return !e || e.call(this, n, t, r);
        var i = f.__c.props !== n;
        return u.forEach(function (n) {
          if (n.__N) {
            var t = n.__[0];
            n.__ = n.__N, n.__N = void 0, o(t, n.__[0]) || (i = !0);
          }
        }), e && e.call(this, n, t, r) || i;
      };
      r.__f = !0;
      var e = r.shouldComponentUpdate,
        a = r.componentWillUpdate;
      r.componentWillUpdate = function (n, t, r) {
        if (4 & this.__g) {
          var u = e;
          e = void 0, c(n, t, r), e = u;
        }
        a && a.call(this, n, t, r);
      }, r.shouldComponentUpdate = c;
    }
    return f.__N || f.__;
  }
  function _(n, u) {
    var i = d(t++, 3);
    !e.__s && C(i.__H, u) && (i.__ = n, i.u = u, r.__H.__h.push(i));
  }
  function A(n, u) {
    var i = d(t++, 4);
    !e.__s && C(i.__H, u) && (i.__ = n, i.u = u, r.__h.push(i));
  }
  function F(n) {
    return f = 5, q(function () {
      return {
        current: n
      };
    }, []);
  }
  function T(n, t, r) {
    f = 6, A(function () {
      if ("function" == typeof n) {
        var r = n(t());
        return function () {
          n(null), r && "function" == typeof r && r();
        };
      }
      if (n) return n.current = t(), function () {
        return n.current = null;
      };
    }, null == r ? r : r.concat(n));
  }
  function q(n, r) {
    var u = d(t++, 7);
    return C(u.__H, r) && (u.__ = n(), u.__H = r, u.__h = n), u.__;
  }
  function b(n, t) {
    return f = 8, q(function () {
      return n;
    }, t);
  }
  function j(n) {
    var u = r.context[n.__c],
      i = d(t++, 9);
    return i.c = n, u ? (null == i.__ && (i.__ = !0, u.sub(r)), u.props.value) : n.__;
  }
  function x(n, t) {
    e.useDebugValue && e.useDebugValue(t ? t(n) : n);
  }
  function O(n) {
    var u = d(t++, 10),
      i = h();
    return u.__ = n, r.componentDidCatch || (r.componentDidCatch = function (n, t) {
      u.__ && u.__(n, t), i[1](n);
    }), [i[0], function () {
      i[1](void 0);
    }];
  }
  function P() {
    var n = d(t++, 11);
    if (!n.__) {
      for (var u = r.__v; null !== u && !u.__m && null !== u.__;) u = u.__;
      var i = u.__m || (u.__m = [0, 0]);
      n.__ = "P" + i[0] + "-" + i[1]++;
    }
    return n.__;
  }
  function g() {
    for (var n; n = c.shift();) if (n.__P && n.__H) try {
      n.__H.__h.forEach(z), n.__H.__h.forEach(B), n.__H.__h = [];
    } catch (t) {
      n.__H.__h = [], e.__e(t, n.__v);
    }
  }
  function w(n) {
    var t,
      r = function () {
        clearTimeout(u), k && cancelAnimationFrame(t), setTimeout(n);
      },
      u = setTimeout(r, 35);
    k && (t = requestAnimationFrame(r));
  }
  function z(n) {
    var t = r,
      u = n.__c;
    "function" == typeof u && (n.__c = void 0, u()), r = t;
  }
  function B(n) {
    var t = r;
    n.__c = n.__(), r = t;
  }
  function C(n, t) {
    return !n || n.length !== t.length || t.some(function (t, r) {
      return !o(t, n[r]);
    });
  }
  function D(n, t) {
    return "function" == typeof t ? t(n) : t;
  }
  _export({
    useCallback: b,
    useContext: j,
    useDebugValue: x,
    useEffect: _,
    useErrorBoundary: O,
    useId: P,
    useImperativeHandle: T,
    useLayoutEffect: A,
    useMemo: q,
    useReducer: y,
    useRef: F,
    useState: h
  });
  return {
    setters: [function (_distPreactMjs) {
      n = _distPreactMjs.options;
    }],
    execute: function () {
      o = Object.is, f = 0, c = [], e = n, a = e.__b, v = e.__r, l = e.diffed, m = e.__c, s = e.unmount, p = e.__;
      e.__b = function (n) {
        r = null, a && a(n);
      }, e.__ = function (n, t) {
        n && t.__k && t.__k.__m && (n.__m = t.__k.__m), p && p(n, t);
      }, e.__r = function (n) {
        v && v(n), t = 0;
        var i = (r = n.__c).__H;
        i && (u === r ? (i.__h = [], r.__h = [], i.__.forEach(function (n) {
          n.__N && (n.__ = n.__N), n.u = n.__N = void 0;
        })) : (i.__h.forEach(z), i.__h.forEach(B), i.__h = [], t = 0)), u = r;
      }, e.diffed = function (n) {
        l && l(n);
        var t = n.__c;
        t && t.__H && (t.__H.__h.length && (1 !== c.push(t) && i === e.requestAnimationFrame || ((i = e.requestAnimationFrame) || w)(g)), t.__H.__.forEach(function (n) {
          n.u && (n.__H = n.u), n.u = void 0;
        })), u = r = null;
      }, e.__c = function (n, t) {
        t.some(function (n) {
          try {
            n.__h.forEach(z), n.__h = n.__h.filter(function (n) {
              return !n.__ || B(n);
            });
          } catch (r) {
            t.some(function (n) {
              n.__h && (n.__h = []);
            }), t = [], e.__e(r, n.__v);
          }
        }), m && m(n, t);
      }, e.unmount = function (n) {
        s && s(n);
        var t,
          r = n.__c;
        r && r.__H && (r.__H.__.forEach(function (n) {
          try {
            z(n);
          } catch (n) {
            t = n;
          }
        }), r.__H = void 0, t && e.__e(t, r.__v));
      };
      k = "function" == typeof requestAnimationFrame;
    }
  };
});