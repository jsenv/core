import { signalRace } from "./signalHelper.js"
import { createSignal } from "@dmail/signal"
import assert from "assert"

{
  const firstSignal = createSignal()
  const secondSignal = createSignal()
  let signalIndex
  signalRace([firstSignal, secondSignal], ({ index }) => {
    signalIndex = index
  })
  firstSignal.emit()

  const actual = signalIndex
  const expected = 0
  assert.equal(actual, expected)
}

{
  const firstSignal = createSignal()
  const secondSignal = createSignal()
  let signalIndex
  signalRace([firstSignal, secondSignal], ({ index }) => {
    signalIndex = index
  })
  secondSignal.emit()

  const actual = signalIndex
  const expected = 1
  assert.equal(actual, expected)
}

console.log("passed")
