import { useSelector, useDispatch, p, u } from "/js/vendors.js";

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
};

export { App };
