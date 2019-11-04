'use strict';

var nativeTypeOf = function nativeTypeOf(obj) {
  return typeof obj;
};

var customTypeOf = function customTypeOf(obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

var assertThisInitialized = (function (self) {
  // eslint-disable-next-line no-void
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return self;
});

var _possibleConstructorReturn = (function (self, call) {
  if (call && (_typeof(call) === "object" || typeof call === "function")) {
    return call;
  }

  return assertThisInitialized(self);
});

var _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : // eslint-disable-next-line no-proto
function (o) {
  return o.__proto__ || Object.getPrototypeOf(o);
};

var setPrototypeOf = Object.setPrototypeOf || function (o, p) {
  // eslint-disable-next-line no-proto
  o.__proto__ = p;
  return o;
};

var _inherits = (function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  if (superClass) setPrototypeOf(subClass, superClass);
});

var _classCallCheck = (function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
});

var Foo = function Foo(value) {
  _classCallCheck(this, Foo);

  this.value = value;
};

var Bar =
/*#__PURE__*/
function (_Foo) {
  _inherits(Bar, _Foo);

  function Bar(value) {
    _classCallCheck(this, Bar);

    return _possibleConstructorReturn(this, _getPrototypeOf(Bar).call(this, value + 1));
  }

  return Bar;
}(Foo);

var _class = new Bar(41).value;

module.exports = _class;
//# sourceMappingURL=main.js.map
