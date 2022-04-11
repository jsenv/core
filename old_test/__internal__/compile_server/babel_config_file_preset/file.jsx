import React from "react"

export const App = () => {
  return <Hello />
}

const Hello = () => "hello"

export const ask = async () => {
  const answer = await Promise.resolve(42)
  return answer
}

export function* generate() {
  yield 0
  yield 1
}
