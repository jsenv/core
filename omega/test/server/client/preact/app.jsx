import { h } from "preact"
import { useState } from "preact/hooks"

export let App = () => {
  const [count, countSetter] = useState(0)
  return (
    <div>
      <p>Hello world</p>
      <span>counter: {count}</span>
      <button
        onClick={() => {
          countSetter((prev) => prev + 1)
        }}
      >
        +1
      </button>

      <button
        onClick={() => {
          countSetter((prev) => prev - 1)
        }}
      >
        -1
      </button>
    </div>
  )
}
