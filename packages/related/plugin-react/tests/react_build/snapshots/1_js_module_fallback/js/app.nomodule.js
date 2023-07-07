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
System.register([__v__("/js/index.nomodule.js?cjs_as_js_module="), __v__("/js/client.nomodule.js?cjs_as_js_module="), __v__("/js/jsx-runtime.nomodule.js?cjs_as_js_module=")], function (_export, _context) {
  "use strict";

  var React, ReactDOM, _jsx, _await$import, Root;
  return {
    setters: [function (_node_modulesReactIndexJsCjs_as_js_module) {
      React = _node_modulesReactIndexJsCjs_as_js_module.default;
    }, function (_node_modulesReactDomClientJsCjs_as_js_module) {
      ReactDOM = _node_modulesReactDomClientJsCjs_as_js_module.default;
    }, function (_node_modulesReactJsxRuntimeJsCjs_as_js_module) {
      _jsx = _node_modulesReactJsxRuntimeJsCjs_as_js_module.jsx;
    }],
    execute: async function () {
      return _await(_context.import(__v__("/js/root.nomodule.js")), function (_context$import) {
        _await$import = _context$import;
        Root = _await$import.Root;
        ReactDOM.createRoot(document.querySelector("#app")).render( /*#__PURE__*/_jsx(React.StrictMode, {
          children: /*#__PURE__*/_jsx(Root, {
            onRender: () => {
              window.resolveResultPromise({
                spanContent: document.querySelector("#app span").innerHTML
              });
            }
          })
        }));
      });
    }
  };
});