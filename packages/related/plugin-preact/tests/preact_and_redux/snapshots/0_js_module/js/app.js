import { useSelector, useDispatch, p, o } from "/js/vendors.js";

const increment = () => {
  return {
    type: "INCREMENT",
  };
};

const decrement = () => {
  return {
    type: "DECREMENT",
  };
};

const counterValueSelector = (state) => {
  return state.counter.value;
};

const App = ({
  onRender
}) => {
  const counterValue = useSelector(counterValueSelector);
  const dispatch = useDispatch();
  p(() => {
    onRender();
  }, []);
  return o("p", {
    children: [o("button", {
      id: "increment",
      onClick: () => {
        dispatch(increment());
      },
      children: "+1"
    }), o("button", {
      id: "decrement",
      onClick: () => {
        dispatch(decrement());
      },
      children: "-1"
    }), o("span", {
      id: "counter_value",
      children: counterValue
    })]
  });
};

export { App };
