import { createBody, createTwoWayStream } from "./index.js"
import assert from "assert"

const getClosed = (body) => {
  let closed = false
  body.closed.listen(() => {
    closed = true
  })
  return closed
}

const getText = (body) => {
  let text = ""
  body.writed.listen((data) => {
    text += data
  })
  return text
}

// createBody() => closed with no data
{
  const body = createBody()

  {
    const actual = getClosed(body)
    const expected = true
    assert.equal(actual, expected)
  }

  {
    const actual = getText(body)
    const expected = ""
    assert.equal(actual, expected)
  }
}

// createBody(data) => closed with data
{
  const body = createBody("hello world")

  {
    const actual = getClosed(body)
    const expected = true
    assert.equal(actual, expected)
  }

  {
    const actual = getText(body)
    const expected = "hello world"
    assert.equal(actual, expected)
  }
}

// createBody(dataSource) => closed when dataSource is closed
{
  const dataSource = createTwoWayStream()
  const body = createBody(dataSource)

  {
    const actual = getClosed(body)
    const expected = false
    assert.equal(actual, expected)
  }

  dataSource.close()
  {
    const actual = getClosed(body)
    const expected = true
    assert.equal(actual, expected)
  }
}

console.log("passed")
