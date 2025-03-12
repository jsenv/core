System.register([__v__("/js/vendors.nomodule.js")], function (_export, _context) {
  "use strict";

  var useSelector, useDispatch, y, u, increment, decrement, counterValueSelector, App;
  return {
    setters: [function (_buildVendorsJs) {
      useSelector = _buildVendorsJs.useSelector;
      useDispatch = _buildVendorsJs.useDispatch;
      y = _buildVendorsJs.y;
      u = _buildVendorsJs.u;
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
        y(() => {
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