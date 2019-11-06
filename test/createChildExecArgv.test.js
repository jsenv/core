import { assert } from "@dmail/assert"
import { createChildExecArgv } from "src/private/node-launcher/createChildExecArgv.js"

// inherit without debug mode
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--test"],
    debugMode: "inherit",
    debugPort: 0,
  })
  const expected = ["--test"]
  assert({ actual, expected })
}

// inherit with --inspect
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--inspect", "--after"],
    debugMode: "inherit",
    debugPort: 10,
  })
  const expected = ["--before", "--inspect=10", "--after"]
  assert({ actual, expected })
}

// inspect with nothing
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--after"],
    debugMode: "inspect",
    debugPort: 10,
  })
  const expected = ["--before", "--after", "--inspect=10"]
  assert({ actual, expected })
}

// inspect with inspect-brk
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--inspect-brk=100", "--after"],
    debugMode: "inspect",
    debugPort: 10,
  })
  const expected = ["--before", "--inspect=10", "--after"]
  assert({ actual, expected })
}
