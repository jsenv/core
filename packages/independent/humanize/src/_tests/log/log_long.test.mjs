// must be verfied by human eyes
// depending on terminal height
// either the whole log can be rewritten (updated)
// or it will be kept and second log appended at the bottom

import { createAnimatedLog } from "@jsenv/inspect";

const animatedLog = createAnimatedLog();
log.update(`
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18`);
log.update(`
a
b
c
d
e
f
g`);
log.update(`
alpha
beta
gamma`);
