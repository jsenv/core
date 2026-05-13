# [formatDay](../../format_time.test.js)

```js
return table(
  ["date", "options", "locale", "result"],
  [
    // default (short + labels)
    ["2026-05-10 (yesterday)", "default", "fr", formatDay(new Date("2026-05-10T09:00:00"), "fr", opts)],
    ["2026-05-11 (today)",     "default", "fr", formatDay(new Date("2026-05-11T09:00:00"), "fr", opts)],
    ["2026-05-12 (tomorrow)",  "default", "fr", formatDay(new Date("2026-05-12T09:00:00"), "fr", opts)],
    ["2026-05-18 (next week)", "default", "fr", formatDay(new Date("2026-05-18T09:00:00"), "fr", opts)],
    ["2026-05-11 (today)",     "default", "en", formatDay(new Date("2026-05-11T09:00:00"), "en", opts)],
    ["2026-05-12 (tomorrow)",  "default", "en", formatDay(new Date("2026-05-12T09:00:00"), "en", opts)],
    // long
    ["2026-05-10 (yesterday)", "long", "fr", formatDay(new Date("2026-05-10T09:00:00"), "fr", { ...opts, long: true })],
    ["2026-05-11 (today)",     "long", "fr", formatDay(new Date("2026-05-11T09:00:00"), "fr", { ...opts, long: true })],
    ["2026-05-12 (tomorrow)",  "long", "fr", formatDay(new Date("2026-05-12T09:00:00"), "fr", { ...opts, long: true })],
    ["2026-05-18 (next week)", "long", "fr", formatDay(new Date("2026-05-18T09:00:00"), "fr", { ...opts, long: true })],
    // labels=false
    ["2026-05-11 (today)",    "labels:false", "fr", formatDay(new Date("2026-05-11T09:00:00"), "fr", { ...opts, labels: false })],
    // custom labels object
    ["2026-05-10 (yesterday)", "labels:{}", "fr", formatDay(new Date("2026-05-10T09:00:00"), "fr", { ...opts, labels: { yesterday: "hier", today: "aujourd'hui", tomorrow: "demain" } })],
    ["2026-05-11 (today)",     "labels:{}", "fr", formatDay(new Date("2026-05-11T09:00:00"), "fr", { ...opts, labels: { yesterday: "hier", today: "aujourd'hui", tomorrow: "demain" } })],
    ["2026-05-12 (tomorrow)",  "labels:{}", "fr", formatDay(new Date("2026-05-12T09:00:00"), "fr", { ...opts, labels: { yesterday: "hier", today: "aujourd'hui", tomorrow: "demain" } })],
    // partial labels object (suppress tomorrow)
    ["2026-05-12 (tomorrow)",  "labels:{today only}", "fr", formatDay(new Date("2026-05-12T09:00:00"), "fr", { ...opts, labels: { today: "aujourd'hui" } })],
  ],
);
```

```js
┌────────────────────────┬─────────────────────┬────────┬────────────────────────────┐
│ date                   │ options             │ locale │ result                     │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-10 (yesterday) │ default             │ fr     │ dim. 10 mai (hier)         │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-11 (today)     │ default             │ fr     │ lun. 11 mai (aujourd’hui)  │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-12 (tomorrow)  │ default             │ fr     │ mar. 12 mai (demain)       │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-18 (next week) │ default             │ fr     │ lun. 18 mai                │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-11 (today)     │ default             │ en     │ Mon, May 11 (today)        │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-12 (tomorrow)  │ default             │ en     │ Tue, May 12 (tomorrow)     │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-10 (yesterday) │ long                │ fr     │ dimanche 10 mai (hier)     │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-11 (today)     │ long                │ fr     │ lundi 11 mai (aujourd’hui) │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-12 (tomorrow)  │ long                │ fr     │ mardi 12 mai (demain)      │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-18 (next week) │ long                │ fr     │ lundi 18 mai               │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-11 (today)     │ labels:false        │ fr     │ lun. 11 mai                │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-10 (yesterday) │ labels:{}           │ fr     │ dim. 10 mai (hier)         │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-11 (today)     │ labels:{}           │ fr     │ lun. 11 mai (aujourd'hui)  │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-12 (tomorrow)  │ labels:{}           │ fr     │ mar. 12 mai (demain)       │
├────────────────────────┼─────────────────────┼────────┼────────────────────────────┤
│ 2026-05-12 (tomorrow)  │ labels:{today only} │ fr     │ mar. 12 mai                │
└────────────────────────┴─────────────────────┴────────┴────────────────────────────┘
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
