# 4.0.0

TODO

# 3.0.0

### introduce color in message for Node.js

The columns marker in the error message is now in red (color is achieved using ansi escape sequence)

### Introduce newline after column marker

Also remove the column number from path

````md
<!-- @jsenv/assert 2.11.0 -->

```console
unexpected character in string
--- details ---
file:///@jsenv/assert/src/internal/something.js
                                   ^ unexpected "s", expected to continue with "/something.js"
--- path ---
actual[35]
```

<!-- @jsenv/assert 3.0.0 -->

```console
unexpected character in string
--- details ---
file:///@jsenv/assert/src/internal/something.js
                                   ^
unexpected "s", expected to continue with "/something.js"
--- path ---
actual
```
````

### Add `assert.between(min, max)`

```js
import { assert } from "@jsenv/assert";

assert({
  actual: 10,
  expected: assert.between(5, 12),
});
```

### Always add line number on string error messages

**before**

```console
unexpected character in string
--- details ---
"Hello,
my name is Damien"
           ^ unexpected "D", expected string continues with "Flore"
--- path ---
actual[18]
```

**after**

```console
unexpected character in string
--- details ---
1 | Hello,
2 | my name is Damien
               ^ unexpected "D", expected string continues with "Flore"
--- path ---
actual
```

# 2.11.0

### improve string failure message

- basic error message is simplified to "unexpected character in string" to make it easier to recognize in a glimpse.
  - failing character moves next to "^" to emphazie the failing character
  - location (index, line, column) removes from error message (already available in "--- path ---")
- the width of the log is truncated when too large to make it more readable

````md
<!-- Input -->

```js
assert({
  actual: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal/something.js`,
  expected: `file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal//something.js`,
});
```

<!-- @jsenv/assert 2.10.0 -->

```console
unexpected string, "s" was found instead of "/" at index 79
--- details ---
"file:///dmail/documents/dev/jsenv-core/node_modules/@jsenv/assert/src/internal/something.js"
                                                                                ^ unexpected character, expected string continues with "/something.js"
--- path ---
actual[79]
```

<!-- @jsenv/assert 2.11.0 -->

```console
unexpected character in string
--- details ---
…node_modules/@jsenv/assert/src/internal/something.js
                                         ^ unexpected "s", expected to continue with "/something.js"
--- path ---
actual[79]
```
````

### add `assert.startsWith`

Add a new helper method `assert.startsWith`. It is useful to perform assertion only on the beginning of a string and allow the rest to be anything. Very useful for error stack where the beginning is know but the rest of error stack is dependent on the filesystem an other things like node modules.

````md
<!-- @jsenv/assert 2.10.0 -->

```js
const stack = `Error: message
  at file.js:10:1
  at node_modules/foo/foo.js:125:10`;
const expected = `Error: message 
  at files.js:10:1`;
const actual = stack.slice(0, expected.length);
assert({ actual, expected });
```

<!-- @jsenv/assert 2.11.0 -->

```js
const actual = `Error: message
  at file.js:10:1
  at node_modules/foo/foo.js:125:10`;
const expected = assert.startsWith(`Error: message
  at files.js:10:1`);
assert({ actual, expected });
```
````

It was also possible to use `matchesRegExp` to obtain `startsWith` but again not very handy to write:

```js
const actual = `Error: message
  at file.js:10:1
  at node_modules/foo/foo.js:125:10`;
const expected = /Error\: message\\n  at files.js\:10\:1.*+/;
const actual = stack.slice(0, expected.length);
assert({ actual, expected });
```

# 2.10.0

#### Improve message for strings

When `actual` contains multiple lines the error message will display them.
There is also a short message around the point of failure showing the unexpected character

````md
<!-- Input -->

```js
assert({
  actual: `Hello,
my name is Damien`,
  expected: `Hello,
my name is Flore`,
});
```

<!-- @jsenv/assert 2.9.0 -->

```console
unequal strings
--- found ---
"Hello,\nmy name is Damien"
--- expected ---
"Hello,\nmy name is Flore"
--- path ---
actual
--- details ---
unexpected character at index 18, "D" was found instead of "F"
```

<!-- @jsenv/assert 2.10.0 -->

```console
unexpected string, "D" was found instead of "F" at index 18
--- details ---
"Hello,
my name is Damien"
           ^ unexpected character, expected string continues with "Flore"
--- path ---
actual[18]#L2C12
```
````

#### Limit message length for strings

When `actual` is too big, a subset of the string is displayed around the point of failure

````md
<!-- Input -->

```js
assert({
  actual: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello world]abcdefghijklmnopqrstuvwxyz`,
  expected: `1abcdefghijklmnopqrstuvwx
2abcdefghijklmnopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello france]abcdefghijklmnopqrstuvwxyz`,
});
```

<!-- @jsenv/assert 2.9.0 -->

```console
unequal strings
--- found ---
"1abcdefghijklmnopqrstuvwx\n2abcdefghijklmnopqrstuvwxy\n3abcdefghijklmnopqrstuvwx\n4abcdefghijklmnopqrstuvwxy\n5abcdefghijklmnopqrstuvwxy\n[Hello world]abcdefghijklmnopqrstuvwxyz"
--- expected ---
"1abcdefghijklmnopqrstuvwx\n2abcdefghijklmnopqrstuvwxy\n3abcdefghijklmnopqrstuvwx\n4abcdefghijklmnopqrstuvwxy\n5abcdefghijklmnopqrstuvwxy\n[Hello france]abcdefghijklmnopqrstuvwxyz"
--- path ---
actual
--- details ---
unexpected character at index 140, "w" was found instead of "f"
```

<!-- @jsenv/assert 2.10.0 -->

```console
unexpected string, "w" was found instead of "f" at index 140
--- details ---
…"nopqrstuvwxy
3abcdefghijklmnopqrstuvwx
4abcdefghijklmnopqrstuvwxy
5abcdefghijklmnopqrstuvwxy
[Hello world]abcdefghijklmnopqrstuvwxyz"
       ^ unexpected character, expected string continues with "france]abcdefgh"…
--- path ---
actual[140]#L6C8
```
````

# 2.9.0

- Improve speed when comparing two node buffers
