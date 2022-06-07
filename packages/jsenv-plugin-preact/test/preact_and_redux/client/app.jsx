import { useSelector, useDispatch } from "react-redux"

import { increment, decrement } from "./counter/counter_action.js"
import { counterValueSelector } from "./counter/counter_selectors.js"

export const App = () => {
  const counterValue = useSelector(counterValueSelector)
  const dispatch = useDispatch()

  return (
    <p>
      <button
        id="increment"
        onClick={() => {
          dispatch(increment())
        }}
      >
        +1
      </button>
      <button
        id="decrement"
        onClick={() => {
          dispatch(decrement())
        }}
      >
        -1
      </button>
      <span id="counter_value">{counterValue}</span>
    </p>
  )
}
