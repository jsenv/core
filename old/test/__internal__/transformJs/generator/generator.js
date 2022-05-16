function* generate() {
  yield 0
  yield 1
}

const generator = generate()
const values = Array.from(generator)

export default values
