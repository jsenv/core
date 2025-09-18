# @jsenv/eslint-plugin

Custom ESLint rules for jsenv projects.

## Installation

```bash
npm install --save-dev @jsenv/eslint-plugin
```

## Usage

Add `@jsenv` to the plugins section of your `.eslintrc` configuration file:

```json
{
  "plugins": ["@jsenv"]
}
```

Then configure the rules you want to use under the rules section:

```json
{
  "rules": {
    "@jsenv/no-extra-params": "warn"
  }
}
```

Or use the recommended configuration:

```json
{
  "extends": ["plugin:@jsenv/recommended"]
}
```

## Rules

### `no-extra-params`

Disallows passing extra parameters that are not used in the function definition.

#### Examples

❌ **Incorrect** code for this rule:

```js
function foo({ a }) {
  console.log(a);
}

foo({ a: 1, b: 2 }); // 'b' is passed but not used
```

✅ **Correct** code for this rule:

```js
function foo({ a, b }) {
  console.log(a, b);
}

foo({ a: 1, b: 2 }); // Both 'a' and 'b' are used
```

```js
function foo({ a }) {
  console.log(a);
}

foo({ a: 1 }); // Only used parameters are passed
```

#### Limitations

Current implementation only handles:

- Functions with object destructuring as the first parameter
- Direct function calls (not method calls or imported functions)
- Simple object property names (not computed properties or renaming)

## License

MIT
