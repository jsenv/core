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

Jsenv works seamlessly with any directory structure and advanced setups like [NPM workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

Below is an example of a project structure:

```console
project/       -> root directory
  dist/        -> build files will be written here
  scripts/     -> executable files
  src/         -> sources files
  package.json
```

For example:

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

- `scripts/dev.mjs`: Starts the development server for files in _src/_. See [B) Dev](../b_dev/b_dev.md).
- `scripts/build.mjs`: Optimize files from _src/_ and write then into _dist/_. See [C) Build](../c_build/c_build.md).
- `scripts/test.mjs`: Execute test files. See [D) Test](../d_test/d_test.md).

You can run script files directly with `node`:

```console
node ./scripts/dev.mjs
```

However, it is a good practice to use NPM scripts. Add the following aliases to package.json:

```json
"scripts": {
  "dev": "node ./scripts/dev.mjs",
  "build": "node ./scripts/build.mjs",
  "test": "node ./scripts/test.mjs"
}
```

Then you can run them via NPM:

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
