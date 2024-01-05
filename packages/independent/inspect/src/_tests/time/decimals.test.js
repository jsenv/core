import { assert } from "@jsenv/assert";

import {
  setRoundedPrecision,
  setCeiledPrecision,
  setFlooredPrecision,
  setPrecision,
} from "@jsenv/inspect/src/internal/decimals.js";

/* numbers between -1 and 1 */
// rounds last decimal
{
  const actual = setRoundedPrecision(0.54);
  const expected = 0.5;
  assert({ actual, expected });
}
{
  const actual = setRoundedPrecision(0.55);
  const expected = 0.6;
  assert({ actual, expected });
}
// floor last decimal
{
  const actual = setFlooredPrecision(0.54);
  const expected = 0.5;
  assert({ actual, expected });
}
{
  const actual = setFlooredPrecision(0.55);
  const expected = 0.5;
  assert({ actual, expected });
}
{
  const actual = setFlooredPrecision(0.501);
  const expected = 0.5;
  assert({ actual, expected });
}
// ceil last decimal
{
  const actual = setCeiledPrecision(0.54);
  const expected = 0.6;
  assert({ actual, expected });
}
{
  const actual = setCeiledPrecision(0.54);
  const expected = 0.6;
  assert({ actual, expected });
}
{
  const actual = setCeiledPrecision(0.501);
  const expected = 0.6;
  assert({ actual, expected });
}
// truncate last decimal
{
  const actual = setPrecision(0.501);
  const expected = 0.5;
  assert({ actual, expected });
}
{
  const actual = setPrecision(0.56);
  const expected = 0.5;
  assert({ actual, expected });
}
// rounded tests
{
  const actual = setRoundedPrecision(0.0101);
  const expected = 0.01;
  assert({ actual, expected });
}
{
  const actual = setRoundedPrecision(0.012);
  const expected = 0.01;
  assert({ actual, expected });
}
{
  const actual = setRoundedPrecision(0.016);
  const expected = 0.02;
  assert({ actual, expected });
}
{
  const actual = setRoundedPrecision(0.016556, {
    decimals: 3,
  });
  const expected = 0.0166;
  assert({ actual, expected });
}
{
  const actual = setRoundedPrecision(0);
  const expected = 0;
  assert({ actual, expected });
}
{
  const actual = setRoundedPrecision(-0.0015);
  const expected = -0.002;
  assert({ actual, expected });
}

/* numbers above 1 */
{
  const actual = setRoundedPrecision(37.04);
  const expected = 37;
  assert({ actual, expected });
}
{
  const actual = setRoundedPrecision(37.05);
  const expected = 37.1;
  assert({ actual, expected });
}
{
  const actual = setCeiledPrecision(37.01);
  const expected = 37.1;
  assert({ actual, expected });
}
{
  const actual = setFlooredPrecision(37.01);
  const expected = 37;
  assert({ actual, expected });
}
