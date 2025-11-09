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
System.register([__v__("/jsenv_plugin_preact_node_modules.js")], function (_export, _context) {
  "use strict";

  var compose, createStore, combineReducers, F, u, Provider_default, counterReducer, composeEnhancers, initialState, store, App, resolveRenderPromise, renderPromise, spanContentAfterIncrement, spanContentAfterDecrement;
  return {
    setters: [function (_buildJsenv_plugin_preact_node_modulesJs) {
      compose = _buildJsenv_plugin_preact_node_modulesJs.compose;
      createStore = _buildJsenv_plugin_preact_node_modulesJs.createStore;
      combineReducers = _buildJsenv_plugin_preact_node_modulesJs.combineReducers;
      F = _buildJsenv_plugin_preact_node_modulesJs.F;
      u = _buildJsenv_plugin_preact_node_modulesJs.u;
      Provider_default = _buildJsenv_plugin_preact_node_modulesJs.Provider_default;
    }],
    execute: async function () {
      counterReducer = (state = {
        value: 0
      }, action) => {
        if (action.type === "INCREMENT") {
          return {
            ...state,
            value: state.value + 1
          };
        }
        if (action.type === "DECREMENT") {
          return {
            ...state,
            value: state.value - 1
          };
        }
        return state;
      };
      composeEnhancers = typeof window !== "undefined" && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
        trace: true
      }) || compose;
      initialState = {
        counter: {
          value: 0
        }
      };
      store = createStore(combineReducers({
        counter: counterReducer
      }), initialState, composeEnhancers());
      return _await(_context.import(__v__("/js/app.nomodule.js")), function (_context$import) {
        ({
          App
        } = _context$import);
        renderPromise = new Promise(resolve => {
          resolveRenderPromise = resolve;
        });
        F(u(Provider_default, {
          store: store,
          children: u(App, {
            onRender: resolveRenderPromise
          })
        }), document.querySelector("#app"));
        return _await(renderPromise, function () {
          document.querySelector("#increment").click();
          return _await(new Promise(resolve => {
            setTimeout(resolve, 100);
          }), function () {
            spanContentAfterIncrement = document.querySelector("#counter_value").innerHTML;
            document.querySelector("#decrement").click();
            return _await(new Promise(resolve => {
              setTimeout(resolve, 100);
            }), function () {
              spanContentAfterDecrement = document.querySelector("#counter_value").innerHTML;
              window.resolveResultPromise({
                spanContentAfterIncrement,
                spanContentAfterDecrement
              });
            });
          });
        });
      });
    }
  };
});