'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _empty() {}

function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

function _settle(pact, state, value) {
  if (!pact.s) {
    if (value instanceof _Pact) {
      if (value.s) {
        if (state & 1) {
          state = value.s;
        }

        value = value.v;
      } else {
        value.o = _settle.bind(null, pact, state);
        return;
      }
    }

    if (value && value.then) {
      value.then(_settle.bind(null, pact, state), _settle.bind(null, pact, 2));
      return;
    }

    pact.s = state;
    pact.v = value;
    var observer = pact.o;

    if (observer) {
      observer(pact);
    }
  }
}

var _Pact =
/*#__PURE__*/
function () {
  function _Pact() {}

  _Pact.prototype.then = function (onFulfilled, onRejected) {
    var result = new _Pact();
    var state = this.s;

    if (state) {
      var callback = state & 1 ? onFulfilled : onRejected;

      if (callback) {
        try {
          _settle(result, 1, callback(this.v));
        } catch (e) {
          _settle(result, 2, e);
        }

        return result;
      } else {
        return this;
      }
    }

    this.o = function (_this) {
      try {
        var value = _this.v;

        if (_this.s & 1) {
          _settle(result, 1, onFulfilled ? onFulfilled(value) : value);
        } else if (onRejected) {
          _settle(result, 1, onRejected(value));
        } else {
          _settle(result, 2, value);
        }
      } catch (e) {
        _settle(result, 2, e);
      }
    };

    return result;
  };

  return _Pact;
}(),
    _earlyReturn =
/*#__PURE__*/
{},
    _asyncIteratorSymbol =
/*#__PURE__*/
typeof Symbol !== "undefined" ? Symbol.asyncIterator || (Symbol.asyncIterator = Symbol("Symbol.asyncIterator")) : "@@asyncIterator",
    _AsyncGenerator =
/*#__PURE__*/
function () {
  function _AsyncGenerator(entry) {
    this._entry = entry;
    this._pact = null;
    this._resolve = null;
    this._return = null;
    this._promise = null;
  }

  function _wrapReturnedValue(value) {
    return {
      value: value,
      done: true
    };
  }

  function _wrapYieldedValue(value) {
    return {
      value: value,
      done: false
    };
  }

  _AsyncGenerator.prototype._yield = function (value) {
    // Yield the value to the pending next call
    this._resolve(value && value.then ? value.then(_wrapYieldedValue) : _wrapYieldedValue(value)); // Return a pact for an upcoming next/return/throw call


    return this._pact = new _Pact();
  };

  _AsyncGenerator.prototype.next = function (value) {
    // Advance the generator, starting it if it has yet to be started
    var _this = this;

    return _this._promise = new Promise(function (resolve) {
      var _pact = _this._pact;

      if (_pact === null) {
        var returnValue = function returnValue(value) {
          _this._resolve(value && value.then ? value.then(_wrapReturnedValue) : _wrapReturnedValue(value));

          _this._pact = null;
          _this._resolve = null;
        };

        var _entry = _this._entry;

        if (_entry === null) {
          // Generator is started, but not awaiting a yield expression
          // Abandon the next call!
          return resolve(_this._promise);
        } // Start the generator


        _this._entry = null;
        _this._resolve = resolve;

        _entry(_this).then(returnValue, function (error) {
          if (error === _earlyReturn) {
            returnValue(_this._return);
          } else {
            var pact = new _Pact();

            _this._resolve(pact);

            _this._pact = null;
            _this._resolve = null;

            _resolve(pact, 2, error);
          }
        });
      } else {
        // Generator is started and a yield expression is pending, settle it
        _this._pact = null;
        _this._resolve = resolve;

        _settle(_pact, 1, value);
      }
    });
  };

  _AsyncGenerator.prototype.return = function (value) {
    // Early return from the generator if started, otherwise abandons the generator
    var _this = this;

    return _this._promise = new Promise(function (resolve) {
      var _pact = _this._pact;

      if (_pact === null) {
        if (_this._entry === null) {
          // Generator is started, but not awaiting a yield expression
          // Abandon the return call!
          return resolve(_this._promise);
        } // Generator is not started, abandon it and return the specified value


        _this._entry = null;
        return resolve(value && value.then ? value.then(_wrapReturnedValue) : _wrapReturnedValue(value));
      } // Settle the yield expression with a rejected "early return" value


      _this._return = value;
      _this._resolve = resolve;
      _this._pact = null;

      _settle(_pact, 2, _earlyReturn);
    });
  };

  _AsyncGenerator.prototype.throw = function (error) {
    // Inject an exception into the pending yield expression
    var _this = this;

    return _this._promise = new Promise(function (resolve, reject) {
      var _pact = _this._pact;

      if (_pact === null) {
        if (_this._entry === null) {
          // Generator is started, but not awaiting a yield expression
          // Abandon the throw call!
          return resolve(_this._promise);
        } // Generator is not started, abandon it and return a rejected Promise containing the error


        _this._entry = null;
        return reject(error);
      } // Settle the yield expression with the value as a rejection


      _this._resolve = resolve;
      _this._pact = null;

      _settle(_pact, 2, error);
    });
  };

  _AsyncGenerator.prototype[_asyncIteratorSymbol] = function () {
    return this;
  };

  return _AsyncGenerator;
}();

var ask = function ask() {
  return new _AsyncGenerator(function (_generator) {
    return _await(Promise.resolve(42), function (value) {
      return _generator._yield(value).then(_empty);
    });
  });
};

exports.ask = ask;
//# sourceMappingURL=main.js.map
