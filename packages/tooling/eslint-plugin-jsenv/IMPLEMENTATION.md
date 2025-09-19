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

### 8. Wrapper Function Support

- **React Wrappers**: `forwardRef()`, `memo()`, `React.forwardRef()`, `React.memo()`
- **JavaScript Standard**: `Function.prototype.bind()`
- Resolves wrapped functions to analyze the original function signature
- Supports both function references and inline function expressions
- Enables proper validation of Higher-Order Components (HOCs)

## 🧪 Test Coverage

The plugin includes comprehensive test coverage with **14 test suites**:

1. **01_function_basic** - Basic function parameter detection
2. **02_arrow_function** - Arrow function support
3. **03_multiple_params** - Multiple parameter validation
4. **04_rest_params** - Rest parameter detection and renaming (2 test files)
5. **05_scope_resolution** - Variable shadowing and scope handling
6. **06_function_chaining** - Parameter propagation analysis
7. **07_jsx** - JSX component prop validation (2 test files)
8. **08_order_independence** - Usage before definition scenarios (3 test files)
9. **09_wrapper_functions** - Wrapper function support (2 test files)
   - React wrappers (forwardRef, memo)
   - Standard JavaScript wrappers (bind)
   - Inline function expressions
10. **10_unknown_functions** - Unknown function handling
    - External/global functions (window._, document._, etc.)
    - Imported functions without definitions
    - Dynamic function assignments

## 🚀 Technical Implementation

### Analysis System

The rule uses a two-pass analysis to handle all JavaScript patterns including usage before definition.

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

### Wrapper Function Resolution

Automatically resolves wrapper functions to analyze the underlying component:

```javascript
// React wrappers
const WrappedComponent = forwardRef(MyComponent);
const MemoizedComponent = memo(MyComponent);
const ReactForwardRef = React.forwardRef(MyComponent);

// JavaScript standard wrappers
const boundFunction = myFunction.bind(null);

// Inline expressions
const InlineWrapper = forwardRef(({ title }) => <div>{title}</div>);

// All validate against the original function signature
WrappedComponent({ title: "Hello", extra: "flagged" }); // extra flagged
```

## 📁 Project Structure

```
packages/tooling/eslint-plugin-jsenv/
├── lib/
│   └── rules/
│       └── no-extra-params.js     # Main rule implementation
├── tests/                         # Comprehensive test suite
│   ├── 01_function_basic/         # Basic function parameter detection
│   ├── 02_arrow_function/         # Arrow function support
│   ├── 03_multiple_params/        # Multiple parameter validation
│   ├── 04_rest_params/           # Rest parameter detection and renaming
│   ├── 05_scope_resolution/      # Variable shadowing and scope handling
│   ├── 06_function_chaining/     # Parameter propagation analysis
│   ├── 07_jsx/                   # JSX component prop validation
│   ├── 08_order_independence/    # Usage before definition scenarios
│   ├── 09_wrapper_functions/     # Wrapper function support (forwardRef, memo, bind)
│   ├── 10_unknown_functions/     # Unknown function handling
│   └── run-all.js               # Test runner
├── package.json
└── index.js                       # Plugin entry point
```

## ✅ Integration

The plugin is integrated into `eslint-config-relax` and automatically available in jsenv projects.

## 🎯 Real-World Usage

Perfect for:

- React component prop validation
- Higher-Order Component (HOC) prop validation
- Function parameter optimization
- Code cleanup and maintenance
- Preventing unused parameter accumulation
- Wrapper function analysis (forwardRef, memo, bind)

## 📋 Test Conventions

All tests follow consistent naming and structure conventions:

### File Naming

- Test directories use underscore (`_`) separators: `01_function_basic`
- Fixture files use underscore separators: `input_valid.js`, `jsx_invalid.jsx`
- Test files end with `.test.js`: `order_independence.test.js`

### Test Structure

- Each test uses `readFileSync` to load fixture files
- Valid cases use `input_valid.js` or `{feature}_valid.js`
- Invalid cases use `input_invalid.js` or `{feature}_invalid.js`
- JSX tests use `.jsx` extension for fixture files
- All tests include descriptive names and expected error messages

### Fixtures Organization

```
{test_suite}/
├── fixtures/
│   ├── input_valid.js        # Main valid test case
│   ├── input_invalid.js      # Main invalid test case
│   ├── {feature}_valid.js    # Feature-specific valid cases
│   └── {feature}_invalid.js  # Feature-specific invalid cases
└── {test_name}.test.js       # Test runner
```
