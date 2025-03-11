import { assert } from "@jsenv/assert";

import { createChildExecOptions } from "@jsenv/test/src/runtime_node/child_exec_options.js";
import { ExecOptions } from "@jsenv/test/src/runtime_node/exec_options.js";

const test = async (params) => {
  const options = await createChildExecOptions(params);
  return ExecOptions.toExecArgv(options);
};

// debug mode inherited from nothing
{
  const actual = await test({
    processExecArgv: ["--test"],
    debugMode: "inherit",
    debugPort: 0,
  });
  const expect = ["--test"];
  assert({ actual, expect });
}

// debug mode inherited from inspect
{
  const actual = await test({
    processExecArgv: ["--before", "--inspect", "--after"],
    debugMode: "inherit",
    debugPort: 10,
  });
  const expect = ["--before", "--inspect=10", "--after"];
  assert({ actual, expect });
}

// debug mode inherited from inspect + port
{
  const actual = await test({
    processExecArgv: ["--before", "--inspect", "--inspect-port=10", "--after"],
    processDebugPort: 10,
    debugMode: "inherit",
    debugPort: 11,
  });
  const expect = ["--before", "--inspect=11", "--after"];
  assert({ actual, expect });
}

// debug mode becomes null from inspect
{
  const actual = await test({
    processExecArgv: ["--before", "--inspect", "--inspect-port=10", "--after"],
    processDebugPort: 10,
    debugMode: "none",
  });
  const expect = ["--before", "--after"];
  assert({ actual, expect });
}

// debug mode becomes inspect from nothing
{
  const actual = await test({
    processExecArgv: ["--before", "--after"],
    debugMode: "inspect",
    debugPort: 10,
  });
  const expect = ["--before", "--after", "--inspect=10"];
  assert({ actual, expect });
}

// debug mode becomes inspect from inspect-brk
{
  const actual = await test({
    processExecArgv: ["--before", "--inspect-brk=100", "--after"],
    debugMode: "inspect",
    debugPort: 10,
  });
  const expect = ["--before", "--after", "--inspect=10"];
  assert({ actual, expect });
}

// debugPort itself it not enough to enable debugging
{
  const actual = await test({
    processExecArgv: ["--before", "--after"],
    debugPort: 10,
  });
  const expect = ["--before", "--after"];
  assert({ actual, expect });
}
