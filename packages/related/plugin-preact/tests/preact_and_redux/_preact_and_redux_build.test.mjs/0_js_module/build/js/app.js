import { useSelector, useDispatch, A, a } from "/vendors.js";

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
};

export { App };