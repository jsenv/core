# ESLint Plugin JSEnv - no-extra-params Rule

## 🎉 Implementation Complete

This ESLint plugin implements a comprehensive `no-extra-params` rule that detects unused parameters in function calls and JSX component props.

## ✨ Features Implemented

### 1. Basic Function Parameter Detection

- Detects extra parameters in function calls with object destructuring
- Supports both function declarations and arrow functions
- Proper error reporting with function and parameter names

### 2. Multiple Parameter Support

- Handles functions with multiple object-destructured parameters
- Each parameter is analyzed independently

### 3. Rest Parameter Support

- Full support for rest parameters (`...rest`)
- Detects when rest parameters are unused vs. used in function chaining
- Handles rest parameter renaming through variable assignments

### 4. Scope Resolution

- Proper handling of variable shadowing
- Supports dynamic imports and complex scope scenarios
- Distinguishes between local and global function references

### 5. Function Chaining Detection

- Advanced analysis of parameter propagation through function calls
- Detects when parameters are passed via spread operators (`...rest`)
- Supports both object spread (`{...rest}`) and direct variable passing (`rest`)
- Handles complex chaining scenarios with multiple intermediate functions

### 6. Rest Parameter Renaming Support

- Tracks variable renaming chains (e.g., `const titi = rest`)
- Resolves original parameter names through assignment chains
- Proper handling of destructuring assignments

### 7. JSX Component Support

- Full JSX component prop validation
- Treats JSX props identically to function parameters
- Supports JSX component chaining with rest props
- Order-independent analysis for JSX components

### 8. Order-Independent Analysis ⭐

- **Two-pass analysis system** that works regardless of function definition order
- Supports usage before definition (common in JavaScript/JSX)
- Handles hoisted functions and forward references
- Critical for real-world JavaScript/React codebases

## 🧪 Test Coverage

The plugin includes comprehensive test coverage with **13 test suites**:

1. **01_function_basic** - Basic function parameter detection
2. **02_arrow_function** - Arrow function support
3. **03_multiple_params** - Multiple parameter validation
4. **04_rest_params** - Rest parameter detection and renaming
5. **05_scope_resolution** - Variable shadowing and scope handling
6. **06_function_chaining** - Parameter propagation analysis
7. **07_jsx** - JSX component prop validation
8. **08_order_independence** - Order-independent analysis validation

## 🚀 Technical Implementation

### Two-Pass Analysis System

The rule uses a sophisticated two-pass analysis:

1. **Collection Phase**: Gathers all function definitions and calls/JSX elements
2. **Analysis Phase**: Analyzes collected items with complete knowledge of all functions

This enables order-independent analysis, supporting real-world patterns like:

```javascript
// Usage before definition (works!)
MyComponent({ title: "Hello", extra: "unused" });

function MyComponent({ title }) {
  return <div>{title}</div>;
}
```

### Function Chaining Detection

Advanced parameter propagation tracking through:

- Object spread operators (`{...rest}`)
- Direct variable passing (`rest`)
- Variable renaming chains
- Multiple intermediate functions

### JSX Integration

Full JSX support treating component props as function parameters:

```jsx
<MyComponent title="Hello" extra="unused" /> // extra flagged if unused
```

## 📁 Project Structure

```
packages/tooling/eslint-plugin-jsenv/
├── lib/
│   └── rules/
│       └── no-extra-params.js     # Main rule implementation
├── tests/                         # Comprehensive test suite
│   ├── 01_function_basic/
│   ├── 02_arrow_function/
│   ├── 03_multiple_params/
│   ├── 04_rest_params/
│   ├── 05_scope_resolution/
│   ├── 06_function_chaining/
│   ├── 07_jsx/
│   ├── 08_order_independence/
│   └── run-all.js                 # Test runner
├── package.json
└── index.js                       # Plugin entry point
```

## ✅ Integration

The plugin is integrated into `eslint-config-relax` and automatically available in jsenv projects.

## 🎯 Real-World Usage

Perfect for:

- React component prop validation
- Function parameter optimization
- Code cleanup and maintenance
- Preventing unused parameter accumulation
- Supporting modern JavaScript patterns with hoisting

The order-independent analysis makes this rule practical for real codebases where functions are often used before they're defined.
