System.register([__v__("/js/index.nomodule.js?cjs_as_js_module="), __v__("/js/jsx-runtime.nomodule.js?cjs_as_js_module=")], function (_export, _context) {
  "use strict";

  var useEffect, _jsx, Root;
  return {
    setters: [function (_node_modulesReactIndexJsCjs_as_js_module) {
      useEffect = _node_modulesReactIndexJsCjs_as_js_module.useEffect;
    }, function (_node_modulesReactJsxRuntimeJsCjs_as_js_module) {
      _jsx = _node_modulesReactJsxRuntimeJsCjs_as_js_module.jsx;
    }],
    execute: function () {
      _export("Root", Root = _ref => {
        let onRender = _ref.onRender;
        useEffect(() => {
          onRender();
        }, []);
        return /*#__PURE__*/_jsx("span", {
          children: "Hello world"
        });
      });
    }
  };
});