# @jsenv/eslint-plugin

ESLint plugin for jsenv projects with advanced parameter validation rules.

## Installation

```bash
npm install @jsenv/eslint-plugin
```

## Usage

```javascript
// eslint.config.js
import jsenvPlugin from "@jsenv/eslint-plugin";

export default [
  {
    plugins: {
      "@jsenv": jsenvPlugin,
    },
    rules: {
      "@jsenv/no-unknown-params": "error",
    },
  },
];
```

> The plugin is automatically included in `@jsenv/eslint-config-relax`. So if you use `@jsenv/eslint-config-relax` you already have it enabled.

## Rules

### `no-unknown-params`

Detects unknown parameters in function calls and JSX component props that are not recognized anywhere in the function definition or call chain.

#### ✅ Valid

```javascript
// Function parameters match usage
function greet({ name }) {
  return `Hello ${name}`;
}
greet({
  name: "John",
});

// JSX props match component parameters
function Button({ title, onClick }) {
  return <button onClick={onClick}>{title}</button>;
}
<Button title="Click me" onClick={handleClick} />;

// Rest parameters with chaining
function processData({ id, ...rest }) {
  return sendToAPI({ ...rest });
}
function sendToAPI({ data, options }) {
  // processes data and options
}
processData({
  id: 1,
  data: "test",
  options: {},
});

// Property renaming in destructuring
function processUser({ name: userName, id: userId }) {
  console.log(userName, userId);
}
processUser({
  name: "John",
  id: 123,
});

// Wrapper functions
const MemoButton = memo(Button);
<MemoButton title="Click me" onClick={handleClick} />;
```

#### ❌ Invalid

```javascript
// Superfluous unused parameters
function greet({ name }) {
  return `Hello ${name}`;
}
greet({
  name: "John",
  age: 25, // ❌ 'age' is not used
});

// Superfluous JSX props
function Button({ onClick }) {
  return <button onClick={onClick}>Click me</button>;
}
<Button
  onClick={handleClick}
  disabled={true} // ❌ 'disabled' is not used
/>;

// Superfluous parameters in rest chains
function processUser({ id, ...rest }) {
  return processData(rest);
}
function processData({ name, email }) {
  return { name, email };
}
processData({
  id: 1,
  data: "test",
  unused: "superfluous", // ❌ 'unused' not used in chain
});
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
- **Property Renaming** - Supports destructuring with renaming (`{ prop: newName }`)
- **Scope Resolution** - Proper variable shadowing and dynamic import handling
- **Order Independence** - Works regardless of function declaration/usage order

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

// ❌ Invalid - superfluous prop
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
window.gtag({ event: "page_view", data: "value" }); // ✅ Ignored
console.log({ message: "hello", level: "debug" }); // ✅ Ignored
external.api({ method: "POST", unused: "param" }); // ✅ Ignored

// Only known functions are analyzed
function myFunction({ name }) {
  return name;
}
myFunction({ name: "test", superfluous: "param" }); // ❌ 'superfluous' flagged
```

## Configuration

The rule has no configuration options - it uses sensible defaults for all scenarios.

## Integration

This plugin is designed for jsenv projects and is automatically included in:

- `@jsenv/eslint-config-relax`
- All jsenv project templates

## Auto-Fix Support

The rule includes automatic fixing capabilities that remove unused parameters:

```javascript
// Before auto-fix
greet({ name: "John", age: 25, city: "NYC" });

// After auto-fix (removes unused parameters)
greet({ name: "John" });
```

**Auto-fix works with:**

- Function calls with object parameters
- JSX component props
- Rest parameter chains
- Wrapper functions (forwardRef, memo, bind)

## Contributing

The plugin uses a comprehensive test suite with **16 test suites** covering all supported patterns. See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for technical details.

## License

MIT
