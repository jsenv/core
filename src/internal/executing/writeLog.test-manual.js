import { assert } from "@jsenv/assert"
import { writeLog } from "./writeLog.js"

{
  const first = writeLog(`1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18`)
  const second = first.update(`a
b
c
d
e
f
g`)
  second.update(`alpha
beta
gamma`)
  // must be verfied by human eyes
  // depending on terminal height
  // either the whole log can be rewritten (updated)
  // or it will be kept and second log appended at the bottom
}

{
  const hello = writeLog(`hello
foo`)
  hello.update(`hello
bar`)

  const expected = `hello
bar`
  const actual = expected // must be verified by human eyes
  assert({ actual, expected })
}

{
  const hello = writeLog("hello")
  console.log("hey")
  const world = hello.update("world")
  world.update("!")

  const expected = `hello
hey
!`
  const actual = expected // must be verified by human eyes
  assert({ actual, expected })
}
