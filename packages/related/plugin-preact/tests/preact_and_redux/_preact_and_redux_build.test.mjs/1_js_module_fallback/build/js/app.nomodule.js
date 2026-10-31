System.register([__v__("/jsenv_plugin_preact_node_modules.js")], function (_export, _context) {
  "use strict";

  var useSelector, useDispatch, A, a, increment, decrement, counterValueSelector, App;
  return {
    setters: [function (_buildJsenv_plugin_preact_node_modulesJs) {
      useSelector = _buildJsenv_plugin_preact_node_modulesJs.useSelector;
      useDispatch = _buildJsenv_plugin_preact_node_modulesJs.useDispatch;
      A = _buildJsenv_plugin_preact_node_modulesJs.A;
      a = _buildJsenv_plugin_preact_node_modulesJs.a;
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
        A(() => {
          onRender();
        }, []);
        return a("p", {
          children: [a("button", {
            id: "increment",
            onClick: () => {
              dispatch(increment());
            },
            children: "+1"
          }), a("button", {
            id: "decrement",
            onClick: () => {
              dispatch(decrement());
            },
            children: "-1"
          }), a("span", {
            id: "counter_value",
            children: counterValue
          })]
        });
      });
    }
  };
});