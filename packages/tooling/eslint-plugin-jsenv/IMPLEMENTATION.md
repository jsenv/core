# ESLint Plugin JSEnv - no-unknown-params Rule

> **⚠️ Documentation Notice**: This implementation document provides a good overview of the project at a specific point in time but will likely become outdated as development continues. While it may not always be kept perfectly up-to-date, it should remain accurate enough to help you understand and dig into the project as it exists today.

## 🎉 Implementation Complete

This ESLint plugin implements a comprehensive `no-unknown-params` rule that detects unused parameters in function calls and JSX component props with intelligent auto-fixing capabilities including typo detection and parameter suggestions.

## ✨ Features Implemented

### 1. Basic Function Parameter Detection

- Detects superfluous parameters in function calls with object destructuring
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

### 7. Property Renaming Support

- Supports destructuring parameter renaming (`{ prop: newName }`)
- Correctly maps original property names to destructured variable names
- Validates against original property names in function calls

### 8. JSX Component Support

- Full JSX component prop validation
- Treats JSX props identically to function parameters
- Supports JSX component chaining with rest props

### 9. Wrapper Function Support

- **React Wrappers**: `forwardRef()`, `memo()`, `React.forwardRef()`, `React.memo()`
- **JavaScript Standard**: `Function.prototype.bind()`
- Resolves wrapped functions to analyze the original function signature
- Supports both function references and inline function expressions
- Enables proper validation of Higher-Order Components (HOCs)

## 🧪 Test Coverage

The plugin includes comprehensive test coverage with **39 tests** across **34 test suites**:

1. **01_function_basic** - Basic function parameter detection
2. **02_arrow_function** - Arrow function support  
3. **03_multiple_params** - Multiple parameter validation
4. **04_rest_params** - Rest parameter detection and renaming (2 test files)
5. **05_scope_resolution** - Variable shadowing and scope handling
6. **06_function_chaining** - Parameter propagation analysis
7. **07_jsx** - JSX component prop validation
8. **08_order_independence** - Usage before definition scenarios (3 test files)
9. **09_wrapper_functions** - Wrapper function support (3 test files)
10. **10_unknown_functions** - Unknown function handling
11. **11_chain_messages** - Error message accuracy in function chains
12. **12_import_resolution** - Cross-file import analysis
13. **13_intermediate_imports** - Multi-level import chains
14. **14_multiple_import_sources** - Multiple file import scenarios
15. **15_import_aliases** - Import alias handling
16. **16_nested_imports** - Nested import structures
17. **17_import_with_errors** - Error handling in imports
18. **18_complex_destructuring** - Advanced destructuring patterns
19. **19_many_parameters** - Large parameter set handling
20. **20_caching_and_performance** - Cache performance optimization (3 test files)
21. **21_import_cycles** - Circular import detection
22. **22_spread_operators** - Spread operator analysis
23. **23_safeguards** - Edge case protection
24. **24_external_functions** - External function handling
25. **25_simple_object_params** - Simple object parameter patterns
26. **26_param_spreading** - Parameter spreading scenarios
27. **27_scope_resolution** - Advanced scope resolution
28. **28_dynamic_imports** - Dynamic import support
29. **31_rest_destructuring_fix** - Rest destructuring fixes
30. **32_rest_tracking_bug** - Rest parameter bug fixes
31. **33_external_imports** - External import handling
32. **34_rest_parameters** - Rest parameter edge cases

## 🚀 Technical Implementation

### Analysis System

The rule uses a sophisticated multi-pass analysis system to handle all JavaScript patterns including usage before definition, cross-file imports, and complex function chaining.

### Import Resolution & Caching

**Context-Based Cache System**: The plugin implements an intelligent caching system organized by ESLint context keys to handle different scenarios:

- **Background/Long-running processes**: ESLint running in IDEs/watchers with potentially unlimited file growth
- **Bulk processing**: Large file sets with different ESLint configurations requiring context-specific cache optimization

**Cache Strategy**:
- Organizes cache by context keys (ESLint configurations) for maximum reuse within configs
- Limits 1000 files per context to prevent unbounded memory growth  
- Uses LRU eviction within each context to keep most recently accessed files
- Implements delayed cleanup (300ms) when switching contexts to allow context reuse while preventing memory leaks
- Aggressive cleanup: when a context is accessed, all other contexts get fresh deletion timers

**File Modification Tracking**: Uses `mtime` checking to ensure cache validity and automatic invalidation of stale entries.

### Auto-Fix Capabilities

The rule provides intelligent automatic fixing with two main capabilities:

**1. Typo Detection & Correction**: Suggests the best parameter name when likely typos are detected
**2. Parameter Removal**: Removes unused parameters from:

- Function calls with object destructuring
- JSX component props
- Rest parameter propagation chains
- Wrapper function calls

### Function Chaining Detection

Advanced parameter propagation tracking through:

- Object spread operators (`{...rest}`)
- Direct variable passing (`rest`)
- Variable renaming chains
- Multiple intermediate functions

### JSX Integration

Full JSX support treating component props as function parameters:

```jsx
<MyComponent title="Hello" superfluous="unused" /> // superfluous flagged if unused
```

**JSX Test Pattern**: All React component tests use proper JSX syntax (`<Component prop="value" />`) instead of function calls to match real-world usage patterns.

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
WrappedComponent({ title: "Hello", superfluous: "flagged" }); // superfluous flagged
```

## 📁 Project Structure

```
packages/tooling/eslint-plugin-jsenv/
├── src/
│   └── rule_no_unknown_params/
│       ├── no_unknown_params.js           # Main rule implementation with 12 message templates  
│       └── utils/
│           ├── import_resolution.js       # Cross-file import analysis with context-based caching
│           ├── debug.js                   # Debug utilities
│           └── wrapper_functions.js       # Wrapper function resolution (forwardRef, memo, etc.)
├── tests/                               # Comprehensive test suite (39 tests across 34 suites)
│   ├── 01_function_basic/               # Basic function parameter detection
│   ├── 02_arrow_function/               # Arrow function support
│   ├── 03_multiple_params/              # Multiple parameter validation
│   ├── 04_rest_params/                  # Rest parameter detection and renaming
│   ├── 05_scope_resolution/             # Variable shadowing and scope handling
│   ├── 06_function_chaining/            # Parameter propagation analysis
│   ├── 07_jsx/                          # JSX component prop validation
│   ├── 08_order_independence/           # Usage before definition scenarios
│   ├── 09_wrapper_functions/            # Wrapper function support (forwardRef, memo, bind)
│   ├── 10_unknown_functions/            # Unknown function handling
│   ├── 11_chain_messages/               # Error message accuracy in function chains
│   ├── 12_import_resolution/            # Cross-file import analysis
│   ├── 13_intermediate_imports/         # Multi-level import chains
│   ├── 14_multiple_import_sources/      # Multiple file import scenarios
│   ├── 15_import_aliases/               # Import alias handling
│   ├── 16_nested_imports/               # Nested import structures
│   ├── 17_import_with_errors/           # Error handling in imports
│   ├── 18_complex_destructuring/        # Advanced destructuring patterns
│   ├── 19_many_parameters/              # Large parameter set handling
│   ├── 20_caching_and_performance/      # Cache performance optimization
│   ├── 21_import_cycles/                # Circular import detection
│   ├── 22_spread_operators/             # Spread operator analysis
│   ├── 23_safeguards/                   # Edge case protection
│   ├── 24_external_functions/           # External function handling
│   ├── 25_simple_object_params/         # Simple object parameter patterns
│   ├── 26_param_spreading/              # Parameter spreading scenarios
│   ├── 27_scope_resolution/             # Advanced scope resolution
│   ├── 28_dynamic_imports/              # Dynamic import support
│   ├── 31_rest_destructuring_fix/       # Rest destructuring fixes
│   ├── 32_rest_tracking_bug/            # Rest parameter bug fixes
│   ├── 33_external_imports/             # External import handling
│   ├── 34_rest_parameters/              # Rest parameter edge cases
│   └── run-all.js                       # Test runner
├── package.json
└── index.js                             # Plugin entry point
```

## ✅ Integration

The plugin is integrated into `eslint-config-relax` and automatically available in jsenv projects.

## 🎯 Real-World Usage

Perfect for:

- **React component prop validation** - Comprehensive JSX prop analysis
- **Higher-Order Component (HOC) analysis** - forwardRef, memo, and custom HOCs
- **Cross-file import validation** - Multi-file function parameter tracking  
- **Function parameter optimization** - Automated cleanup with intelligent suggestions
- **Code maintenance** - Preventing parameter bloat and catching typos
- **Large codebase management** - Efficient caching for performance at scale
- **Wrapper function analysis** - Automatic resolution of wrapped functions

## 📋 Test Conventions

All tests follow consistent naming and structure conventions:

### File Naming

- Test directories use underscore (`_`) separators: `01_function_basic`
- Test files end with `.test.js`: `order_independence.test.js`
- Multiple test files per category when needed: `rest_params.test.js`, `rest_rename.test.js`

### Test Structure

- **Inline Code**: All tests use inline code instead of fixture files for better readability
- **Focused Testing**: Each test case validates one specific behavior
- **JSX Syntax**: React component tests use proper JSX syntax (`<Component />`) not function calls
- **Auto-fix Output**: Invalid tests include `output` property showing expected auto-fix results
- **Clean Source Code**: No explanatory comments in source code, descriptions in test metadata

### Test Organization

```
{test_suite}/
├── {feature1}.test.js       # Main test file with inline code
├── {feature2}.test.js       # Additional focused test file
└── fixtures/               # Legacy fixtures (being phased out)
    └── (deprecated files)
```
