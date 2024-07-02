import { assert } from "@jsenv/assert";

import {
  setRoundedPrecision,
  setCeiledPrecision,
  setFlooredPrecision,
  setPrecision,
} from "@jsenv/humanize/src/utils/decimals.js";

/* numbers between -1 and 1 */
// rounds last decimal
{
  const actual = setRoundedPrecision(0.54);
  const expect = 0.5;
  assert({ actual, expect });
}
{
  const actual = setRoundedPrecision(0.55);
  const expect = 0.6;
  assert({ actual, expect });
}
// floor last decimal
{
  const actual = setFlooredPrecision(0.54);
  const expect = 0.5;
  assert({ actual, expect });
}
{
  const actual = setFlooredPrecision(0.55);
  const expect = 0.5;
  assert({ actual, expect });
}
{
  const actual = setFlooredPrecision(0.501);
  const expect = 0.5;
  assert({ actual, expect });
}
// ceil last decimal
{
  const actual = setCeiledPrecision(0.54);
  const expect = 0.6;
  assert({ actual, expect });
}
{
  const actual = setCeiledPrecision(0.54);
  const expect = 0.6;
  assert({ actual, expect });
}
{
  const actual = setCeiledPrecision(0.501);
  const expect = 0.6;
  assert({ actual, expect });
}
// truncate last decimal
{
  const actual = setPrecision(0.501);
  const expect = 0.5;
  assert({ actual, expect });
}
{
  const actual = setPrecision(0.56);
  const expect = 0.5;
  assert({ actual, expect });
}
// rounded tests
{
  const actual = setRoundedPrecision(0.0101);
  const expect = 0.01;
  assert({ actual, expect });
}
{
  const actual = setRoundedPrecision(0.012);
  const expect = 0.01;
  assert({ actual, expect });
}
{
  const actual = setRoundedPrecision(0.016);
  const expect = 0.02;
  assert({ actual, expect });
}
{
  const actual = setRoundedPrecision(0.016556, {
    decimals: 3,
  });
  const expect = 0.0166;
  assert({ actual, expect });
}
{
  const actual = setRoundedPrecision(0);
  const expect = 0;
  assert({ actual, expect });
}
{
  const actual = setRoundedPrecision(-0.0015);
  const expect = -0.002;
  assert({ actual, expect });
}

/* numbers above 1 */
{
  const actual = setRoundedPrecision(37.04);
  const expect = 37;
  assert({ actual, expect });
}
{
  const actual = setRoundedPrecision(37.05);
  const expect = 37.1;
  assert({ actual, expect });
}
{
  const actual = setCeiledPrecision(37.01);
  const expect = 37.1;
  assert({ actual, expect });
}
{
  const actual = setFlooredPrecision(37.01);
  const expect = 37;
  assert({ actual, expect });
}
