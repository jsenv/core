import { createStore, compose } from "redux"

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose
const enhancer = composeEnhancers()
const initialState = { message: "hello world" }

const store = createStore(
  (state = initialState) => {
    return state
  },
  { message: "hello world" },
  enhancer,
)
window.store = store
