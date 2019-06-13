# importMap

To know where to find imports most jsenv tools accept an `importMapRelativePath` option and will expect to find an importMap file in JSON format.<br />

## importMap file example

`importMap.json`

```json
{
  "imports": {
    "lodash": "/node_modules/lodash/index.js"
  }
}
```

`importMap.json` file above would allow you to write import from `"lodash"` and tool would know where to find the real file.<br />

```js
import whatever from "lodash"
```

Generating importMap for a project node modules can, and must be, automated.<br />
jsenv provides this feature behind an npm package called `@jsenv/node-module-import-map`.<br />
Read part below to see how to use it.

## How to use `@jsenv/node-module-import-map`

1. Install `@jsenv/node-module-import-map`

```shell
npm i --save-dev @jsenv/node-module-import-map
```

2. Create a script capable to generate importMap for your project

`root/generate-import-map.js`

```js
const { generateImportMapForProjectNodeModules } = require("@jsenv/node-module-import-map")

generateImportMapForProjectNodeModules({
  projectPath: __dirname,
})
```

3. Run `root/generate-import-map.js`

```shell
node ./generate-import-map.js
```

It will write `/root/importMap.json` containing data capable to remap node module import to actual location on filesystem.

### importMap must be in sync with node_modules

`/importMap.json` must be in sync with `/node_modules/`. It means you should regenerate `/importMap.json` after every npm install for instance. <br />

### Avoid using importMap for custom aliases

A custom alias is the ability to write import from `"foo"` and expect a tool to remap the import to an actual file on the filesystem.<br />
I say **custom** alias because that alias would be specific to your project and not generated from node modules.

```js
import whatever from "foo"
```

It looks convenient but<br />

- custom remapping are likely going to conflict with a future node module name or native module name.<br />
- a newcomer, or even you two month later, will likely not understand where or what is `"foo"`. Aliases can make complex something as simple as a filesystem, please don't do that.

I believe project relative import can replace aliases for the better.<br />
— see [project relative import documentation](../project-relative-import/project-relative-import.md).
