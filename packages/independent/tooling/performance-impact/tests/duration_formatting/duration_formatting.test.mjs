import { assert } from "@jsenv/assert";
import { formatMetricValue } from "@jsenv/performance-impact/src/internal/format_metric_value.js";

{
  const actual = formatMetricValue({ unit: "ms", value: 0.168999 });
  const expect = `0 second`;
  assert({ actual, expect });
}

{
  const actual = formatMetricValue({ unit: "ms", value: 2 });
  const expect = `0.002 second`;
  assert({ actual, expect });
}

{
  const actual = formatMetricValue({ unit: "ms", value: 59 });
  const expect = `0.06 second`;
  assert({ actual, expect });
}

{
  const actual = formatMetricValue({ unit: "ms", value: 1059.456 });
  const expect = `1.1 seconds`;
  assert({ actual, expect });
}

{
  const actual = formatMetricValue({ unit: "ms", value: 1002.456 });
  const expect = `1 second`;
  assert({ actual, expect });
}
