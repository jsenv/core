import { assert } from "@jsenv/assert"
import { inspect } from "@jsenv/inspect"

{
  const actual = inspect([])
  const expected = `[]`
  assert({ actual, expected })
}

{
  const actual = inspect([[]])
  const expected = `[
  []
]`
  assert({ actual, expected })
}

{
  const actual = inspect(Array(3))
  // prettier-ignore
  const expected = `[
  ,
  ,
${"  "}
]`
  assert({ actual, expected })
}

{
  const actual = inspect([Symbol()])
  const expected = `[
  Symbol()
]`
  assert({ actual, expected })
}

{
  // eslint-disable-next-line no-array-constructor
  const newArray = new Array("foo", 1)

  {
    const actual = inspect(newArray)
    const expected = `[
  "foo",
  1
]`
    assert({
      actual,
      expected,
    })
  }

  {
    const actual = inspect(newArray)
    const expected = `[
  "foo",
  1
]`
    assert({ actual, expected })
  }
}

{
  const circularArray = [0]
  circularArray.push(circularArray)
  const actual = inspect(circularArray)
  const expected = `[
  0,
  Symbol.for('circular')
]`
  assert({ actual, expected })
}
