import { assert } from "@jsenv/assert";
import { formatSize } from "@jsenv/file-size-impact/src/internal/format_size.js";

{
  const actual = formatSize(1048074.24);
  const expect = `1 MB`;
  assert({ actual, expect });
}
