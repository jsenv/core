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

Jsenv works seamlessly with any directory structure, requiring no additional configuration. It also supports advanced setups like [NPM workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

Below is an example of a typical project structure:

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

- `scripts/dev.mjs`: Starts the development server for files in src/. This enables live reloading and debugging during development. See [B) Dev](../b_dev/b_dev.md).
- `scripts/build.mjs`: Optimizes files from src/ and writes them into dist/. This is typically used for production deployment. See [C) Build](../c_build/c_build.md).
- `scripts/test.mjs`: Executes test files to ensure code quality and functionality. See [D) Test](../d_test/d_test.md).

You can run script files directly with `node`:

```console
node ./scripts/dev.mjs
```

However, it is a best practice to use NPM scripts. Add the following aliases to `package.json`:

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
