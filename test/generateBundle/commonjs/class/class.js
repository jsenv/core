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

export const value = new Bar(41).value
