# @jsenv/eslint-plugin

ESLint plugin for jsenv projects with advanced parameter validation rules.

## Installation

```bash
npm install @jsenv/eslint-plugin
```

## Usage

The plugin is automatically included in `@jsenv/eslint-config-relax`. For manual setup:

```javascript
// eslint.config.js
import jsenvPlugin from "@jsenv/eslint-plugin";

export default [
  {
    plugins: {
      "@jsenv": jsenvPlugin,
    },
    rules: {
      "@jsenv/no-extra-params": "error",
    },
  },
];
```

## Rules

### `no-extra-params`

Detects unused parameters in function calls and JSX component props.

#### ✅ Valid

```javascript
// Function parameters match usage
function greet({ name }) {
  return `Hello ${name}`;
}
greet({ name: "John" }); // ✅ OK

// JSX props match component parameters
function Button({ title, onClick }) {
  return <button onClick={onClick}>{title}</button>;
}
<Button title="Click me" onClick={handleClick} />; // ✅ OK

// Rest parameters with chaining
function processData({ id, ...rest }) {
  return sendToAPI({ ...rest });
}
function sendToAPI({ data, options }) {
  // processes data and options
}
processData({ id: 1, data: "test", options: {} }); // ✅ OK

// Wrapper functions
const MemoButton = memo(Button);
<MemoButton title="Click me" onClick={handleClick} />; // ✅ OK
```

#### ❌ Invalid

```javascript
// Extra unused parameters
function greet({ name }) {
  return `Hello ${name}`;
}
greet({ name: "John", age: 25 }); // ❌ 'age' is not used

// Extra JSX props
function Button({ title }) {
  return <button>{title}</button>;
}
<Button title="Click me" disabled />; // ❌ 'disabled' is not used

// Extra parameters in rest chains
function processData({ id, ...rest }) {
  return sendToAPI({ ...rest });
}
function sendToAPI({ data }) {
  // only uses data
}
processData({ id: 1, data: "test", unused: "extra" }); // ❌ 'unused' not used in chain
```

## Features

### 🎯 Core Functionality

- **Function Parameter Detection** - Analyzes object destructuring parameters
- **JSX Component Props** - Validates React component prop usage
- **Multiple Parameters** - Handles functions with multiple destructured parameters
- **Arrow Functions** - Full support for arrow function expressions

### 🔗 Advanced Analysis

- **Rest Parameter Support** - Tracks `...rest` parameter usage through function chains
- **Function Chaining** - Detects parameter propagation via spread operators
- **Variable Renaming** - Handles rest parameter renaming (`const renamed = rest`)
- **Scope Resolution** - Proper variable shadowing and dynamic import handling

### 🛠️ Wrapper Functions

- **React HOCs** - `forwardRef()`, `memo()`, `React.forwardRef()`, `React.memo()`
- **JavaScript Standard** - `Function.prototype.bind()`
- **Inline Expressions** - Supports both function references and inline expressions
- **Automatic Resolution** - Resolves to underlying function signatures

### 🚀 Smart Handling

- **Usage Before Definition** - Works regardless of function declaration order
- **Unknown Functions** - Ignores external/imported functions without definitions
- **JSX Integration** - Treats JSX props identically to function parameters

## Examples

### Function Chaining

```javascript
// Complex parameter propagation
function handleRequest({ url, method, ...options }) {
  return processOptions({ ...options });
}

function processOptions({ headers, timeout }) {
  // Implementation
}

// ✅ Valid - all parameters are used in the chain
handleRequest({
  url: "/api/data",
  method: "GET",
  headers: { Accept: "application/json" },
  timeout: 5000,
});

// ❌ Invalid - 'retry' is not used anywhere in the chain
handleRequest({
  url: "/api/data",
  method: "GET",
  headers: { Accept: "application/json" },
  retry: 3, // ❌ unused parameter
});
```

### React Component Validation

```javascript
// Component definition
function UserCard({ name, email, avatar }) {
  return (
    <div>
      <img src={avatar} alt={name} />
      <h3>{name}</h3>
      <p>{email}</p>
    </div>
  );
}

// Wrapper components
const MemoizedUserCard = memo(UserCard);
const ForwardedUserCard = forwardRef(UserCard);

// ✅ Valid usage
<MemoizedUserCard
  name="John Doe"
  email="john@example.com"
  avatar="/avatar.jpg"
/>

// ❌ Invalid - extra prop
<ForwardedUserCard
  name="John Doe"
  email="john@example.com"
  avatar="/avatar.jpg"
  theme="dark" // ❌ unused prop
/>
```

### Unknown Functions

```javascript
// These are ignored - no analysis performed
window.gtag({ event: "page_view", extra: "data" }); // ✅ Ignored
console.log({ message: "hello", level: "debug" }); // ✅ Ignored
external.api({ method: "POST", unused: "param" }); // ✅ Ignored

// Only known functions are analyzed
function myFunction({ name }) {
  return name;
}
myFunction({ name: "test", extra: "param" }); // ❌ 'extra' flagged
```

## Configuration

The rule has no configuration options - it uses sensible defaults for all scenarios.

## Integration

This plugin is designed for jsenv projects and is automatically included in:

- `@jsenv/eslint-config-relax`
- All jsenv project templates

## Contributing

The plugin uses a comprehensive test suite with 14 test categories covering all supported patterns. See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for technical details.

## License

MIT

Current implementation only handles:

- Functions with object destructuring as the first parameter
- Direct function calls (not method calls or imported functions)
- Simple object property names (not computed properties or renaming)

## License

MIT
