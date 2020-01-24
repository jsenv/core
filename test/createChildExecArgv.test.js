import { assert } from "@jsenv/assert"
import { createChildExecArgv } from "../src/internal/node-launcher/createChildExecArgv.js"

// debug mode inherited from nothing
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--test"],
    debugMode: "inherit",
    debugPort: 0,
  })
  const expected = ["--test"]
  assert({ actual, expected })
}

// debug mode inherited from inspect
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--inspect", "--after"],
    debugMode: "inherit",
    debugPort: 10,
  })
  const expected = ["--before", "--inspect=10", "--after"]
  assert({ actual, expected })
}

// debug mode inherited from inspect + port
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--inspect", "--inspect-port=10", "--after"],
    processDebugPort: 10,
    debugMode: "inherit",
    debugPort: 11,
  })
  const expected = ["--before", "--inspect", "--inspect-port=11", "--after"]
  assert({ actual, expected })
}

// debug mode becomes null from inspect
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--inspect", "--inspect-port=10", "--after"],
    processDebugPort: 10,
    debugMode: "none",
  })
  const expected = ["--before", "--after"]
  assert({ actual, expected })
}

// debug mode becomes inspect from nothing
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--after"],
    debugMode: "inspect",
    debugPort: 10,
  })
  const expected = ["--before", "--after", "--inspect=10"]
  assert({ actual, expected })
}

// debug mode becomes inspect from inspect-brk
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--inspect-brk=100", "--after"],
    debugMode: "inspect",
    debugPort: 10,
  })
  const expected = ["--before", "--inspect=10", "--after"]
  assert({ actual, expected })
}

// unhandledRejection inherited by default
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--unhandled-rejections=warn", "--after"],
  })
  const expected = ["--before", "--unhandled-rejections=warn", "--after"]
  assert({ actual, expected })
}

// unhandledRejection becomes strict form warn
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--unhandled-rejections=warn", "--after"],
    unhandledRejection: "strict",
  })
  const expected = ["--before", "--unhandled-rejections=strict", "--after"]
  assert({ actual, expected })
}

// unhandledRejection becomes strict from nothing
{
  const actual = await createChildExecArgv({
    processExecArgv: ["--before", "--after"],
    unhandledRejection: "strict",
  })
  const expected = ["--before", "--after", "--unhandled-rejections=strict"]
  assert({ actual, expected })
}
