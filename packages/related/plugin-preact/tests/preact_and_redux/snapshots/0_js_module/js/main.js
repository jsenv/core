import { compose, createStore, combineReducers, B, o, Provider } from "/js/vendors.js";

const counterReducer = (state = { value: 0 }, action) => {
  if (action.type === "INCREMENT") {
    return {
      ...state,
      value: state.value + 1,
    };
  }
  if (action.type === "DECREMENT") {
    return {
      ...state,
      value: state.value - 1,
    };
  }
  return state;
};

const composeEnhancers =
  (typeof window !== "undefined" &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
      trace: true,
    })) ||
  compose;

const initialState = {
  counter: {
    value: 0,
  },
};

const store = createStore(
  combineReducers({
    counter: counterReducer,
  }),
  initialState,
  composeEnhancers(),
);

const {
  App
} = await import(__v__("/js/app.js"));
let resolveRenderPromise;
const renderPromise = new Promise(resolve => {
  resolveRenderPromise = resolve;
});
B(o(Provider, {
  store: store,
  children: o(App, {
    onRender: resolveRenderPromise
  })
}), document.querySelector("#app"));
await renderPromise;
// increment
document.querySelector("#increment").click();
await new Promise(resolve => {
  setTimeout(resolve, 100);
});
const spanContentAfterIncrement = document.querySelector("#counter_value").innerHTML;
// decrement
document.querySelector("#decrement").click();
await new Promise(resolve => {
  setTimeout(resolve, 100);
});
const spanContentAfterDecrement = document.querySelector("#counter_value").innerHTML;
// resolve with what we found
window.resolveResultPromise({
  spanContentAfterIncrement,
  spanContentAfterDecrement
});
