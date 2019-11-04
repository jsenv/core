System.register([], function (exports) {
  'use strict';
  return {
    execute: function () {

      var nativeTypeOf = function nativeTypeOf(obj) {
        return typeof obj;
      };

      var customTypeOf = function customTypeOf(obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };

      var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

      function createCommonjsModule(fn, module) {
        return module = {
          exports: {}
        }, fn(module, module.exports), module.exports;
      }
      /*
      object-assign
      (c) Sindre Sorhus
      @license MIT
      */

      /* eslint-disable no-unused-vars */


      var getOwnPropertySymbols = Object.getOwnPropertySymbols;
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var propIsEnumerable = Object.prototype.propertyIsEnumerable;

      function toObject(val) {
        if (val === null || val === undefined) {
          throw new TypeError('Object.assign cannot be called with null or undefined');
        }

        return Object(val);
      }

      function shouldUseNative() {
        try {
          if (!Object.assign) {
            return false;
          } // Detect buggy property enumeration order in older V8 versions.
          // https://bugs.chromium.org/p/v8/issues/detail?id=4118


          var test1 = new String('abc'); // eslint-disable-line no-new-wrappers

          test1[5] = 'de';

          if (Object.getOwnPropertyNames(test1)[0] === '5') {
            return false;
          } // https://bugs.chromium.org/p/v8/issues/detail?id=3056


          var test2 = {};

          for (var i = 0; i < 10; i++) {
            test2['_' + String.fromCharCode(i)] = i;
          }

          var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
            return test2[n];
          });

          if (order2.join('') !== '0123456789') {
            return false;
          } // https://bugs.chromium.org/p/v8/issues/detail?id=3056


          var test3 = {};
          'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
            test3[letter] = letter;
          });

          if (Object.keys(Object.assign({}, test3)).join('') !== 'abcdefghijklmnopqrst') {
            return false;
          }

          return true;
        } catch (err) {
          // We don't expect any of the above to throw, but better to be safe.
          return false;
        }
      }

      var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
        var from;
        var to = toObject(target);
        var symbols;

        for (var s = 1; s < arguments.length; s++) {
          from = Object(arguments[s]);

          for (var key in from) {
            if (hasOwnProperty.call(from, key)) {
              to[key] = from[key];
            }
          }

          if (getOwnPropertySymbols) {
            symbols = getOwnPropertySymbols(from);

            for (var i = 0; i < symbols.length; i++) {
              if (propIsEnumerable.call(from, symbols[i])) {
                to[symbols[i]] = from[symbols[i]];
              }
            }
          }
        }

        return to;
      };
      var n = "function" === typeof Symbol && Symbol.for,
          p = n ? Symbol.for("react.element") : 60103,
          q = n ? Symbol.for("react.portal") : 60106,
          r = n ? Symbol.for("react.fragment") : 60107,
          t = n ? Symbol.for("react.strict_mode") : 60108,
          u = n ? Symbol.for("react.profiler") : 60114,
          v = n ? Symbol.for("react.provider") : 60109,
          w = n ? Symbol.for("react.context") : 60110,
          x = n ? Symbol.for("react.forward_ref") : 60112,
          y = n ? Symbol.for("react.suspense") : 60113,
          aa = n ? Symbol.for("react.suspense_list") : 60120,
          ba = n ? Symbol.for("react.memo") : 60115,
          ca = n ? Symbol.for("react.lazy") : 60116;
      var z = "function" === typeof Symbol && Symbol.iterator;

      function A(a) {
        for (var b = a.message, d = "https://reactjs.org/docs/error-decoder.html?invariant=" + b, c = 1; c < arguments.length; c++) {
          d += "&args[]=" + encodeURIComponent(arguments[c]);
        }

        a.message = "Minified React error #" + b + "; visit " + d + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings. ";
        return a;
      }

      var B = {
        isMounted: function isMounted() {
          return !1;
        },
        enqueueForceUpdate: function enqueueForceUpdate() {},
        enqueueReplaceState: function enqueueReplaceState() {},
        enqueueSetState: function enqueueSetState() {}
      },
          C = {};

      function D(a, b, d) {
        this.props = a;
        this.context = b;
        this.refs = C;
        this.updater = d || B;
      }

      D.prototype.isReactComponent = {};

      D.prototype.setState = function (a, b) {
        if ("object" !== _typeof(a) && "function" !== typeof a && null != a) throw A(Error(85));
        this.updater.enqueueSetState(this, a, b, "setState");
      };

      D.prototype.forceUpdate = function (a) {
        this.updater.enqueueForceUpdate(this, a, "forceUpdate");
      };

      function E() {}

      E.prototype = D.prototype;

      function F(a, b, d) {
        this.props = a;
        this.context = b;
        this.refs = C;
        this.updater = d || B;
      }

      var G = F.prototype = new E();
      G.constructor = F;
      objectAssign(G, D.prototype);
      G.isPureReactComponent = !0;
      var H = {
        current: null
      },
          I = {
        suspense: null
      },
          J = {
        current: null
      },
          K = Object.prototype.hasOwnProperty,
          L = {
        key: !0,
        ref: !0,
        __self: !0,
        __source: !0
      };

      function M(a, b, d) {
        var c = void 0,
            e = {},
            g = null,
            k = null;
        if (null != b) for (c in void 0 !== b.ref && (k = b.ref), void 0 !== b.key && (g = "" + b.key), b) {
          K.call(b, c) && !L.hasOwnProperty(c) && (e[c] = b[c]);
        }
        var f = arguments.length - 2;
        if (1 === f) e.children = d;else if (1 < f) {
          for (var l = Array(f), m = 0; m < f; m++) {
            l[m] = arguments[m + 2];
          }

          e.children = l;
        }
        if (a && a.defaultProps) for (c in f = a.defaultProps, f) {
          void 0 === e[c] && (e[c] = f[c]);
        }
        return {
          $$typeof: p,
          type: a,
          key: g,
          ref: k,
          props: e,
          _owner: J.current
        };
      }

      function da(a, b) {
        return {
          $$typeof: p,
          type: a.type,
          key: b,
          ref: a.ref,
          props: a.props,
          _owner: a._owner
        };
      }

      function N(a) {
        return "object" === _typeof(a) && null !== a && a.$$typeof === p;
      }

      function escape(a) {
        var b = {
          "=": "=0",
          ":": "=2"
        };
        return "$" + ("" + a).replace(/[=:]/g, function (a) {
          return b[a];
        });
      }

      var O = /\/+/g,
          P = [];

      function Q(a, b, d, c) {
        if (P.length) {
          var e = P.pop();
          e.result = a;
          e.keyPrefix = b;
          e.func = d;
          e.context = c;
          e.count = 0;
          return e;
        }

        return {
          result: a,
          keyPrefix: b,
          func: d,
          context: c,
          count: 0
        };
      }

      function R(a) {
        a.result = null;
        a.keyPrefix = null;
        a.func = null;
        a.context = null;
        a.count = 0;
        10 > P.length && P.push(a);
      }

      function S(a, b, d, c) {
        var e = _typeof(a);

        if ("undefined" === e || "boolean" === e) a = null;
        var g = !1;
        if (null === a) g = !0;else switch (e) {
          case "string":
          case "number":
            g = !0;
            break;

          case "object":
            switch (a.$$typeof) {
              case p:
              case q:
                g = !0;
            }

        }
        if (g) return d(c, a, "" === b ? "." + T(a, 0) : b), 1;
        g = 0;
        b = "" === b ? "." : b + ":";
        if (Array.isArray(a)) for (var k = 0; k < a.length; k++) {
          e = a[k];
          var f = b + T(e, k);
          g += S(e, f, d, c);
        } else if (null === a || "object" !== _typeof(a) ? f = null : (f = z && a[z] || a["@@iterator"], f = "function" === typeof f ? f : null), "function" === typeof f) for (a = f.call(a), k = 0; !(e = a.next()).done;) {
          e = e.value, f = b + T(e, k++), g += S(e, f, d, c);
        } else if ("object" === e) throw d = "" + a, A(Error(31), "[object Object]" === d ? "object with keys {" + Object.keys(a).join(", ") + "}" : d, "");
        return g;
      }

      function U(a, b, d) {
        return null == a ? 0 : S(a, "", b, d);
      }

      function T(a, b) {
        return "object" === _typeof(a) && null !== a && null != a.key ? escape(a.key) : b.toString(36);
      }

      function ea(a, b) {
        a.func.call(a.context, b, a.count++);
      }

      function fa(a, b, d) {
        var c = a.result,
            e = a.keyPrefix;
        a = a.func.call(a.context, b, a.count++);
        Array.isArray(a) ? V(a, c, d, function (a) {
          return a;
        }) : null != a && (N(a) && (a = da(a, e + (!a.key || b && b.key === a.key ? "" : ("" + a.key).replace(O, "$&/") + "/") + d)), c.push(a));
      }

      function V(a, b, d, c, e) {
        var g = "";
        null != d && (g = ("" + d).replace(O, "$&/") + "/");
        b = Q(b, g, c, e);
        U(a, fa, b);
        R(b);
      }

      function W() {
        var a = H.current;
        if (null === a) throw A(Error(321));
        return a;
      }

      var X = {
        Children: {
          map: function map(a, b, d) {
            if (null == a) return a;
            var c = [];
            V(a, c, null, b, d);
            return c;
          },
          forEach: function forEach(a, b, d) {
            if (null == a) return a;
            b = Q(null, null, b, d);
            U(a, ea, b);
            R(b);
          },
          count: function count(a) {
            return U(a, function () {
              return null;
            }, null);
          },
          toArray: function toArray(a) {
            var b = [];
            V(a, b, null, function (a) {
              return a;
            });
            return b;
          },
          only: function only(a) {
            if (!N(a)) throw A(Error(143));
            return a;
          }
        },
        createRef: function createRef() {
          return {
            current: null
          };
        },
        Component: D,
        PureComponent: F,
        createContext: function createContext(a, b) {
          void 0 === b && (b = null);
          a = {
            $$typeof: w,
            _calculateChangedBits: b,
            _currentValue: a,
            _currentValue2: a,
            _threadCount: 0,
            Provider: null,
            Consumer: null
          };
          a.Provider = {
            $$typeof: v,
            _context: a
          };
          return a.Consumer = a;
        },
        forwardRef: function forwardRef(a) {
          return {
            $$typeof: x,
            render: a
          };
        },
        lazy: function lazy(a) {
          return {
            $$typeof: ca,
            _ctor: a,
            _status: -1,
            _result: null
          };
        },
        memo: function memo(a, b) {
          return {
            $$typeof: ba,
            type: a,
            compare: void 0 === b ? null : b
          };
        },
        useCallback: function useCallback(a, b) {
          return W().useCallback(a, b);
        },
        useContext: function useContext(a, b) {
          return W().useContext(a, b);
        },
        useEffect: function useEffect(a, b) {
          return W().useEffect(a, b);
        },
        useImperativeHandle: function useImperativeHandle(a, b, d) {
          return W().useImperativeHandle(a, b, d);
        },
        useDebugValue: function useDebugValue() {},
        useLayoutEffect: function useLayoutEffect(a, b) {
          return W().useLayoutEffect(a, b);
        },
        useMemo: function useMemo(a, b) {
          return W().useMemo(a, b);
        },
        useReducer: function useReducer(a, b, d) {
          return W().useReducer(a, b, d);
        },
        useRef: function useRef(a) {
          return W().useRef(a);
        },
        useState: function useState(a) {
          return W().useState(a);
        },
        Fragment: r,
        Profiler: u,
        StrictMode: t,
        Suspense: y,
        unstable_SuspenseList: aa,
        createElement: M,
        cloneElement: function cloneElement(a, b, d) {
          if (null === a || void 0 === a) throw A(Error(267), a);
          var c = void 0,
              e = objectAssign({}, a.props),
              g = a.key,
              k = a.ref,
              f = a._owner;

          if (null != b) {
            void 0 !== b.ref && (k = b.ref, f = J.current);
            void 0 !== b.key && (g = "" + b.key);
            var l = void 0;
            a.type && a.type.defaultProps && (l = a.type.defaultProps);

            for (c in b) {
              K.call(b, c) && !L.hasOwnProperty(c) && (e[c] = void 0 === b[c] && void 0 !== l ? l[c] : b[c]);
            }
          }

          c = arguments.length - 2;
          if (1 === c) e.children = d;else if (1 < c) {
            l = Array(c);

            for (var m = 0; m < c; m++) {
              l[m] = arguments[m + 2];
            }

            e.children = l;
          }
          return {
            $$typeof: p,
            type: a.type,
            key: g,
            ref: k,
            props: e,
            _owner: f
          };
        },
        createFactory: function createFactory(a) {
          var b = M.bind(null, a);
          b.type = a;
          return b;
        },
        isValidElement: N,
        version: "16.9.0",
        unstable_withSuspenseConfig: function unstable_withSuspenseConfig(a, b) {
          var d = I.suspense;
          I.suspense = void 0 === b ? null : b;

          try {
            a();
          } finally {
            I.suspense = d;
          }
        },
        __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
          ReactCurrentDispatcher: H,
          ReactCurrentBatchConfig: I,
          ReactCurrentOwner: J,
          IsSomeRendererActing: {
            current: !1
          },
          assign: objectAssign
        }
      },
          Y = {
        default: X
      },
          Z = Y && X || Y;
      var react_production_min = Z.default || Z;
      var react_development = createCommonjsModule(function (module) {});
      var react = createCommonjsModule(function (module) {
        {
          module.exports = react_production_min;
        }
      });

      var react$1 = exports('default', _typeof(react));

    }
  };
});
//# sourceMappingURL=main.js.map
