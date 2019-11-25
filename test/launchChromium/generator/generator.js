function* test() {
  yield 21
  yield 21
}

const values = Array.from(test())

export default values[0] + values[1]
