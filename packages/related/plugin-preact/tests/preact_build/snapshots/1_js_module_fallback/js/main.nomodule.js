function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }
    try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}
function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }
  if (!value || !value.then) {
    value = Promise.resolve(value);
  }
  return then ? value.then(then) : value;
}
System.register([__v__("/js/preact.module.nomodule.js"), __v__("/js/jsxRuntime.module.nomodule.js")], function (_export, _context) {
  "use strict";

  var render, _jsx, _await$import, App;
  return {
    setters: [function (_node_modulesPreactDistPreactModuleJs) {
      render = _node_modulesPreactDistPreactModuleJs.render;
    }, function (_node_modulesPreactJsxRuntimeDistJsxRuntimeModuleJs) {
      _jsx = _node_modulesPreactJsxRuntimeDistJsxRuntimeModuleJs.jsx;
    }],
    execute: async function () {
      return _await(_context.import(__v__("/js/app.nomodule.js")), function (_context$import) {
        _await$import = _context$import;
        App = _await$import.App;
        render(_jsx(App, {}), document.querySelector("#app"));
        window.resolveResultPromise({
          spanContent: document.querySelector("#app span").innerHTML
        });
      });
    }
  };
});