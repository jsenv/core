class Foo {
  constructor(value) {
    this.value = value
  }
}

class Bar extends Foo {
  constructor(value) {
    super(value + 1)
  }
}

export default new Bar(41).value
