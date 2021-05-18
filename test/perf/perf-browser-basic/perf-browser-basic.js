/* eslint-env browser */

performance.mark("a")
// eslint-disable-next-line no-self-compare, no-unused-expressions
1 === 1
performance.mark("b")
performance.measure("a to b", "a", "b")
