import { useState } from "react"

export const App = () => {
  const [count, countSetter] = useState(0)

  return (
    <div>
      <span style={{ color: "black" }}>tata: {count}</span>
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
