function* test() {
  yield 0
  yield 1
}

const values = Array.from(test())

export const value = values
