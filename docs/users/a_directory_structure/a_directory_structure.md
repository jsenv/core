<!-- TITLE: A) Directory Structure -->

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      A) Directory Structure
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../b_dev/b_dev.md">&gt; B) Dev</a>
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->

Jsenv is compatible with any directory structure. It is also compatible with advanced use cases like [NPM workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

This page shows how directory and files can be organized.
A few key directories and files are introduced like "source files" and "build files":

```console
project/       -> root directory
  dist/        -> build files will be written here
  scripts/     -> executable files
  src/         -> sources files
  package.json
```

With a few files it gives the following result:

```console
project/
  dist/
    index.html
  scripts/
    build.mjs
    dev.mjs
    test.mjs
  src/
    index.html
  package.json
```

`scripts/` contains files executable directly with `node` command.

| File        | Description                                            | Link to doc                       |
| ----------- | ------------------------------------------------------ | --------------------------------- |
| _dev.mjs_   | starts a dev server for files in _src/_                | [B) Dev](../b_dev/b_dev.md)       |
| _build.mjs_ | optimize files from _src/_ and write then into _dist/_ | [C) Build](../c_build/c_build.md) |
| _test.mjs_  | execute test files                                     | [D) Test](../d_test/d_test.md)    |

You can execute these files directory with `node`:

```console
node ./scripts/dev.mjs
```

In general it's recommended to execute files via an alias.  
To achieve this, the following can be added to _package.json_:

```json
"scripts": {
  "dev": "node ./scripts/dev.mjs",
  "build": "node ./scripts/build.mjs",
  "test": "node ./scripts/test.mjs"
}
```

Allowing to execute files using NPM as follows:

```console
npm run dev
npm run build
npm run test
```

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      A) Directory Structure
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../b_dev/b_dev.md">&gt; B) Dev</a>
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->
