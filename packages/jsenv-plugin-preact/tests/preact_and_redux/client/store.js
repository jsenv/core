import { createStore, combineReducers, compose } from "redux"

import { counterReducer } from "./counter/counter_reducer.js"

const composeEnhancers =
  (typeof window !== "undefined" &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
      trace: true,
    })) ||
  compose

const initialState = {
  counter: {
    value: 0,
  },
}

export const store = createStore(
  combineReducers({
    counter: counterReducer,
  }),
  initialState,
  composeEnhancers(),
)
