import { assert } from "@jsenv/assert";
import { setNpmConfig } from "@jsenv/package-publish/src/internal/set_npm_config.js";

{
  const actual = setNpmConfig("", { whatever: 42 });
  const expect = "whatever=42";
  assert({ actual, expect });
}

{
  const actual = setNpmConfig(`whatever=41`, { whatever: 42 });
  const expect = `whatever=42`;
  assert({ actual, expect });
}

{
  const actual = setNpmConfig("foo=bar", { whatever: 42 });
  const expect = `foo=bar
whatever=42`;
  assert({ actual, expect });
}

{
  const actual = setNpmConfig(
    `foo=bar
whatever=41`,
    { whatever: 42 },
  );
  const expect = `foo=bar
whatever=42`;
  assert({ actual, expect });
}

{
  const actual = setNpmConfig(
    `foo=bar
whatever=41
ding=dong`,
    { whatever: 42 },
  );
  const expect = `foo=bar
whatever=42
ding=dong`;
  assert({ actual, expect });
}
