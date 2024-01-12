System.register([__v__("/js/main.nomodule.js")], function (_export, _context) {
  "use strict";

  var useSelector, useDispatch, p, u, increment, decrement, counterValueSelector, App;
  return {
    setters: [function (_mainJsx) {
      useSelector = _mainJsx.useSelector;
      useDispatch = _mainJsx.useDispatch;
      p = _mainJsx.p;
      u = _mainJsx.u;
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
        p(() => {
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