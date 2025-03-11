System.register([], function (_export, _context) {
  "use strict";

  var BBB, AAA;

  function _await(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _call(body, then, direct) {
    if (direct) {
      return then ? then(body()) : body();
    }

    try {
      var result = Promise.resolve(body());
      return then ? result.then(then) : result;
    } catch (e) {
      return Promise.reject(e);
    }
  }
  /* eslint-disable no-unused-vars */


  return {
    setters: [],
    execute: function () {
      BBB = function () {
        return _await("b");
      };

      AAA = function () {
        return _await("a");
      };

      {
        const _window = window,
              _resolveResultPromise = _window.resolveResultPromise;

        _call(AAA, function (_AAA) {
          return _call(BBB, function (_BBB) {
            _resolveResultPromise.call(_window, {
              a: _AAA,
              b: _BBB
            });
          });
        });
      }
    }
  };
});