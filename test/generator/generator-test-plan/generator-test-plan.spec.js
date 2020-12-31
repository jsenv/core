import { generateZeroAndOne } from "./generator-test-plan.js"

const generator = generateZeroAndOne()

{
  const actual = generator.next().value
  const expected = 0
  if (actual !== expected) {
    throw new Error(`generateZeroAndOne() must yield 0, got ${actual}`)
  }
}

{
  const actual = generator.next().value
  const expected = 1
  if (actual !== expected) {
    throw new Error(`generateZeroAndOne() must yield 1, got ${actual}`)
  }
}

{
  const actual = generator.next().done
  const expected = true
  if (actual !== expected) {
    throw new Error(`generateZeroAndOne() must be done after yielding 1`)
  }
}
