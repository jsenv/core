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

Jsenv works seamlessly with any directory structure and supports advanced setups, such as [NPM workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

**Suggested directory structure**

```console
project/       -> root directory
  dist/        -> build files will be written here
  scripts/     -> executable files
  src/         -> sources files
  package.json
```

Example structure with some key files:

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

**Scripts files**

- **dev.mjs**: Starts the development server for files in _src/_. See [B) Dev](../b_dev/b_dev.md).
- **build.mjs**: Optimize files from _src/_ and write then into \_dist/. See [C) Build](../c_build/c_build.md).
- **test.mjs**: Execute test files. See [D) Test](../d_test/d_test.md).

**Running script files**

You can execute these files directory with `node`:

```console
node ./scripts/dev.mjs
```

Alternatively add aliases in _package.json_:

```json
"scripts": {
  "dev": "node ./scripts/dev.mjs",
  "build": "node ./scripts/build.mjs",
  "test": "node ./scripts/test.mjs"
}
```

This allows execution via NPM:

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
