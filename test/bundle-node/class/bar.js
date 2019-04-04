import { Foo } from "./foo.js"

export class Bar extends Foo {
  constructor(value) {
    super(value + 1)
  }
}
