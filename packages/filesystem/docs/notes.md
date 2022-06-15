## Urls parts

You can refer to figure below to see how each part of an url is named.

<pre>
                                                           href
                   ┌────────────────────────────────────────┴──────────────────────────────────────────────┐
                origin                                                                                     │
      ┌────────────┴──────────────┐                                                                        │
      │                       authority                                                                    │
      │           ┌───────────────┴───────────────────────────┐                                            │
      │           │                                         host                                        ressource
      │           │                                ┌──────────┴────────────────┐             ┌──────────────┴────────┬────────┐
      │           │                             hostname                       │          pathname                   │        │
      │           │                 ┌──────────────┴────────────┐              │      ┌──────┴──────┐                │        │
  protocol     userinfo         subdomain                    domain            │      │          filename            │        │
   ┌─┴──┐     ┌───┴────┐            │                  ┌────────┴───────┐      │      │         ┌───┴─────┐          │        │
scheme  │username password lowerleveldomains secondleveldomain topleveldomain port dirname   basename extension   search     hash
┌──┴───┐│┌──┴───┐ ┌──┴───┐ ┌──┬─┬─┴─────┬───┐┌───────┴───────┐ ┌──────┴──────┐┌┴┐┌────┴─────┐ ┌──┴───┐ ┌───┴───┐ ┌────┴────┐ ┌┴┐
│      │││      │ │      │ │  │ │       │   ││               │ │             ││ ││          │ │      │ │       │ │         │ │ │
scheme://username:password@test.abcdedgh.www.secondleveldomain.topleveldomain:123/hello/world/basename.extension?name=ferret#hash
</pre>

## Entry

_entry_ word is used when a function does not assume what it is going to interact with: file, directory, or something else. For example [copyEntry({ from, to })](#copyEntry) will take whatever is at _from_ and copy it at _to_.

# prefer url over filesystem path

An url is better than a filesystem path because it does not care about the underlying filesystem format.

- A file url: `file:///directory/file.js`
- A Windows file path: `C:\\directory\\file.js`
- A Linux file path: `/directory/file.js`

# prefer url string over url object

There is a deliberate preference for url string over url object in the documentation and codebase.

```js
const urlString = "file:///directory/file.js"
const urlObject = new URL("file:///directory/file.js")
```

A string is a simpler primitive than an url object and it becomes important while debugging.

_Screenshot of an url object while debugging_

![screenshot of url object while debugging in vscode](./docs/debug-url-object.png)

_Screenshot of an url string while debugging_

![screenshot of url string while debugging in vscode](./docs/debug-url-string.png)

# fs lack support for url string

`fs` module accepts url object since version 7.6 but not url string.

![screenshot of readFile documentation changelog](./docs/screenshot-node-doc-url.png)

Passing an url string to a function from `fs` will always throw [ENOENT](https://nodejs.org/api/errors.html#errors_common_system_errors) error.

```js
import { readFileSync } from "fs"

readFileSync(import.meta.url) // throw ENOENT
```

```js
const { readFileSync } = require("fs")

readFileSync(`file://${__filename}`) // throw ENOENT
```

> Node.js made this choice for performance reasons but it hurts my productivity.
