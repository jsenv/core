# [parseDuration](../../duration.test.js)

```js
const cases = [
  // single units (singular only)
  "2hour",
  "15minute",
  "30second",
  "140millisecond",
  "3day",
  "2week",
  "1month",
  "1year",
  // compound
  "2hour15minute",
  "1year2month3day",
  "1hour20minute30second",
  "1second140millisecond",
  // spaces are NOT trimmed -- " 15" is the raw minute value
  "2hour 15minute",
  // decimal value
  "1.14second",
  // negative sign
  "-1second",
  // invalid values preserved (parser only splits, does not validate)
  "2ahour",
  // plural forms not accepted (format is singular-only)
  "2hours",
  "15minutes",
  // object passthrough
  { hours: 2, minutes: 15 },
  {},
  // invalid / missing unit
  "30",
  "",
  null,
  undefined,
  42,
];

const rows = cases.map((value) => {
  const result = parseDuration(value);
  return [cell(humanize(value)), cell(humanize(result))];
});

return renderTable([[cell("input"), cell("parseDuration()")], ...rows], {
  borderCollapse: true,
  maxRows: Infinity,
});
```

```js
┌─────────────────────────┬───────────────────────┐
│ input                   │ parseDuration()       │
├─────────────────────────┼───────────────────────┤
│ "2hour"                 │ {                     │
│                         │   "hours": 2          │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "15minute"              │ {                     │
│                         │   "minutes": 15       │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "30second"              │ {                     │
│                         │   "seconds": 30       │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "140millisecond"        │ {                     │
│                         │   "milliseconds": 140 │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "3day"                  │ {                     │
│                         │   "days": 3           │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "2week"                 │ {                     │
│                         │   "weeks": 2          │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "1month"                │ {                     │
│                         │   "months": 1         │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "1year"                 │ {                     │
│                         │   "years": 1          │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "2hour15minute"         │ {                     │
│                         │   "hours": 2,         │
│                         │   "minutes": 15       │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "1year2month3day"       │ {                     │
│                         │   "years": 1,         │
│                         │   "months": 2,        │
│                         │   "days": 3           │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "1hour20minute30second" │ {                     │
│                         │   "hours": 1,         │
│                         │   "minutes": 20,      │
│                         │   "seconds": 30       │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "1second140millisecond" │ {                     │
│                         │   "seconds": 1,       │
│                         │   "milliseconds": 140 │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "2hour 15minute"        │ {                     │
│                         │   "hours": 2,         │
│                         │   "minutes": 15       │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "1.14second"            │ {                     │
│                         │   "seconds": 1.14     │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "-1second"              │ {                     │
│                         │   "seconds": -1       │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "2ahour"                │ {                     │
│                         │   "hours": "2a"       │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "2hours"                │ {                     │
│                         │   "hours": 2          │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ "15minutes"             │ {                     │
│                         │   "minutes": 15       │
│                         │ }                     │
├─────────────────────────┼───────────────────────┤
│ {                       │ {                     │
│   "hours": 2,           │   "hours": 2,         │
│   "minutes": 15         │   "minutes": 15       │
│ }                       │ }                     │
├─────────────────────────┼───────────────────────┤
│ {}                      │ {}                    │
├─────────────────────────┼───────────────────────┤
│ "30"                    │ null                  │
├─────────────────────────┼───────────────────────┤
│ ""                      │ null                  │
├─────────────────────────┼───────────────────────┤
│ null                    │ null                  │
├─────────────────────────┼───────────────────────┤
│ undefined               │ null                  │
├─────────────────────────┼───────────────────────┤
│ 42                      │ null                  │
└─────────────────────────┴───────────────────────┘
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
