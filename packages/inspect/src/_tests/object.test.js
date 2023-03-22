import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

{
  const actual = inspect({})
  const expected = "{}"
  assert({ actual, expected })
}

{
  // eslint-disable-next-line no-new-object
  const actual = inspect(new Object({}))
  const expected = "{}"
  assert({ actual, expected })
}

{
  const actual = inspect({}, { objectConstructor: true })
  const expected = "Object({})"
  assert({ actual, expected })
}

{
  const actual = inspect(
    { foo: true },
    { objectConstructor: true, useNew: true },
  )
  const expected = `new Object({
  "foo": true
})`
  assert({
    actual,
    expected,
  })
}

{
  const actual = inspect({ 0: "foo" })
  const expected = `{
  0: "foo"
}`
  assert({ actual, expected })
}

{
  const actual = inspect({ Infinity: "foo" })
  const expected = `{
  "Infinity": "foo"
}`
  assert({ actual, expected })
}

{
  const actual = inspect({ name: "dam" }, { quote: "'" })
  const expected = `{
  'name': 'dam'
}`
  assert({ actual, expected })
}

{
  const actual = inspect(
    { foo: true, nested: { bar: true } },
    { parenthesis: true },
  )
  const expected = `({
  "foo": true,
  "nested": ({
    "bar": true
  })
})`
  assert({ actual, expected })
}

{
  const foo = { foo: true, bar: false }

  const actual = inspect(foo)
  const expected = `{
  "foo": true,
  "bar": false
}`
  assert({ actual, expected })
}

{
  const actual = inspect(
    Object.create({
      foo: true,
    }),
  )
  const expected = "{}"
  assert({ actual, expected })
}

{
  const nested = { foo: { name: "dam" } }
  const actual = inspect(nested)
  const expected = `{
  "foo": {
    "name": "dam"
  }
}`
  assert({ actual, expected })
}

{
  const circularObject = {
    foo: true,
  }
  circularObject.self = circularObject
  const actual = inspect(circularObject)
  const expected = `{
  "foo": true,
  "self": Symbol.for('circular')
}`
  assert({ actual, expected })
}

{
  const nestedCircularObject = {
    foo: true,
  }
  nestedCircularObject.nested = {
    bar: true,
    parent: nestedCircularObject,
  }
  const actual = inspect(nestedCircularObject)
  const expected = `{
  "foo": true,
  "nested": {
    "bar": true,
    "parent": Symbol.for('circular')
  }
}`
  assert({ actual, expected })
}

{
  const actual = inspect(Object.create(null))
  const expected = "{}"
  assert({ actual, expected })
}

{
  const object = Object.create(null)
  object[Symbol.toStringTag] = "stuff"
  const actual = inspect(object)
  const expected = `{
  [Symbol("Symbol.toStringTag")]: "stuff"
}`
  assert({ actual, expected })
}

{
  const object = Object.create(null)
  object[Symbol.toStringTag] = "stuff"
  object.foo = true
  const actual = inspect(object)
  const expected = `{
  "foo": true,
  [Symbol("Symbol.toStringTag")]: "stuff"
}`
  assert({ actual, expected })
}

{
  const actual = inspect({ [Symbol()]: true })
  const expected = `{
  [Symbol()]: true
}`
  assert({ actual, expected })
}
