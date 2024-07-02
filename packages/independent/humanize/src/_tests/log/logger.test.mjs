import { assert } from "@jsenv/assert";

import { createLogger } from "@jsenv/humanize";

try {
  createLogger({ logLevel: "foo" });
  throw new Error("should throw");
} catch (actual) {
  const expect = new Error(`unexpected logLevel.
--- logLevel ---
foo
--- allowed log levels ---
off
error
warn
info
debug`);
  assert({ actual, expect });
}

{
  const logger = createLogger();
  const actual = logger.levels;
  const expect = {
    debug: false,
    info: true,
    warn: true,
    error: true,
  };
  assert({ actual, expect });
}

{
  const logger = createLogger({ logLevel: "off" });
  const actual = logger.levels;
  const expect = {
    debug: false,
    info: false,
    warn: false,
    error: false,
  };
  assert({ actual, expect });
}

{
  const logger = createLogger({ logLevel: "debug" });
  const actual = logger.levels;
  const expect = {
    debug: true,
    info: true,
    warn: true,
    error: true,
  };
  assert({ actual, expect });
}

{
  const logger = createLogger({ logLevel: "info" });
  const actual = logger.levels;
  const expect = {
    debug: false,
    info: true,
    warn: true,
    error: true,
  };
  assert({ actual, expect });
}

{
  const logger = createLogger({ logLevel: "warn" });
  const actual = logger.levels;
  const expect = {
    debug: false,
    info: false,
    warn: true,
    error: true,
  };
  assert({ actual, expect });
}

{
  const logger = createLogger({ logLevel: "error" });
  const actual = logger.levels;
  const expect = {
    debug: false,
    info: false,
    warn: false,
    error: true,
  };
  assert({ actual, expect });
}
