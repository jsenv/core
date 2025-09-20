# @jsenv/eslint-plugin

ESLint plugin for jsenv projects with advanced parameter validation rules.

## Table of Contents

- [@jsenv/eslint-plugin](#jsenveslint-plugin)
  - [Table of Contents](#table-of-contents)
  - [Rules](#rules)
    - [`no-unknown-params`](#no-unknown-params)
      - [✅ Valid](#-valid)
      - [❌ Invalid](#-invalid)
  - [Features](#features)
    - [🎯 Core Functionality](#-core-functionality)
    - [🔗 Advanced Analysis](#-advanced-analysis)
  - [Auto-Fix Support](#auto-fix-support)
    - [Typo Detection and Correction](#typo-detection-and-correction)
    - [Parameter Removal](#parameter-removal)
  - [Examples](#examples)
    - [Function Chaining](#function-chaining)
    - [React Component Validation](#react-component-validation)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Contributing](#contributing)

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

- **Function Parameter Detection** - Analyzes object destructuring parameters in function calls
- **JSX Component Props** - Validates React component prop usage with well-known props patterns
- **React HOCs Support** - Works with `forwardRef()`, `memo()`, and other Higher Order Components
- **Multiple Parameters** - Handles functions with multiple destructured parameters

### 🔗 Advanced Analysis

Performs sophisticated analysis including rest parameter chains, function chaining via spread operators, property renaming, and scope resolution with order-independent detection.

The rule automatically ignores external/imported functions without definitions (see [IMPLEMENTATION.md](./IMPLEMENTATION.md) for technical details).

## Auto-Fix Support

The rule includes automatic fixing capabilities with intelligent suggestions:

### Typo Detection and Correction

```javascript
// Before auto-fix - likely typo detected
function greet({ name }) {
  return `Hello ${name}`;
}
greet({ nam: "John" }); // ❌ 'nam' not found in "name"

// After auto-fix - suggests best match
greet({ name: "John" }); // ✅ Fixed to 'name'
```

### Parameter Removal

```javascript
// Before auto-fix - unused parameters
greet({ name: "John", age: 25, city: "NYC" });

// After auto-fix - removes unused parameters
greet({ name: "John" });
```

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

> The plugin is automatically included in [@jsenv/eslint-config-relax](../eslint-config-relax). So if you use `@jsenv/eslint-config-relax` you already have it enabled.

The rule has no configuration options - it uses sensible defaults for all scenarios.

## Contributing

The plugin uses a comprehensive test suite with **39 tests** covering all supported patterns. See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for technical details.
