System.register([__v__("/jsenv_plugin_preact_node_modules.js")], function (_export, _context) {
  "use strict";

  var useSelector, useDispatch, _, u, increment, decrement, counterValueSelector, App;
  return {
    setters: [function (_buildJsenv_plugin_preact_node_modulesJs) {
      useSelector = _buildJsenv_plugin_preact_node_modulesJs.useSelector;
      useDispatch = _buildJsenv_plugin_preact_node_modulesJs.useDispatch;
      _ = _buildJsenv_plugin_preact_node_modulesJs._;
      u = _buildJsenv_plugin_preact_node_modulesJs.u;
    }],
    execute: function () {
      increment = () => {
        return {
          type: "INCREMENT"
        };
      };
      decrement = () => {
        return {
          type: "DECREMENT"
        };
      };
      counterValueSelector = state => {
        return state.counter.value;
      };
      _export("App", App = ({
        onRender
      }) => {
        const counterValue = useSelector(counterValueSelector);
        const dispatch = useDispatch();
        _(() => {
          onRender();
        }, []);
        return u("p", {
          children: [u("button", {
            id: "increment",
            onClick: () => {
              dispatch(increment());
            },
            children: "+1"
          }), u("button", {
            id: "decrement",
            onClick: () => {
              dispatch(decrement());
            },
            children: "-1"
          }), u("span", {
            id: "counter_value",
            children: counterValue
          })]
        });
      });
    }
  };
});