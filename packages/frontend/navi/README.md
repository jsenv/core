# @jsenv/navi

> Your guide through modern web application development

**@jsenv/navi** is a comprehensive frontend framework designed to simplify navigation, state management, and UI development. Named after Navi, the fairy guide from Zelda, it helps you navigate through the complexities of building modern web applications.

## What it provides

### 🧭 Navigation
- **Client-side routing** with URL synchronization
- **Link components** that enhance standard anchor tags
- **History management** and navigation state
- **Route-based code splitting** and lazy loading

### 🔄 State Management
- **Signal-based reactive state** using `@preact/signals`
- **Actions system** for async operations with built-in loading/error states
- **Action proxies** that automatically react to signal changes
- **Resource management** with caching and deduplication

### 🎨 UI Components

#### Form Controls
- **Input** - Enhanced input elements with validation and styling
- **Button** - Configurable buttons with loading states and appearances
- **Radio/RadioList** - Radio buttons with icon support and button appearance
- **Field** - Form field wrapper with labels and validation
- **Label** - Semantic form labels

#### Layout & Visual
- **Box** - Flexible layout container with spacing and alignment
- **Text** - Typography component with size and color variants
- **Icon** - Icon wrapper for SVGs, emojis, and images
- **Address** - Semantic address component

#### Navigation
- **Link** - Enhanced anchor tags with action execution
- **Details** - Collapsible content with navigation state persistence

### 🎯 Key Features

- **Standards-first approach** - Built on web standards rather than custom abstractions
- **Progressive enhancement** - Works with and without JavaScript
- **Accessibility** - Built-in ARIA support and keyboard navigation
- **TypeScript support** - Full type safety with JSDoc annotations
- **Server-side rendering** - Compatible with SSR environments
- **Lightweight** - Minimal runtime with tree-shaking support

## Quick Example

```jsx
import { render } from "preact";
import { Link, Button, Box, createAction, useActionProxy } from "@jsenv/navi";

const fetchUserAction = createAction(async ({ userId }) => {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
});

const App = () => {
  const userProxy = useActionProxy(fetchUserAction, { userId: 123 });

  return (
    <Box column spacing="lg">
      <Link href="/profile">Go to Profile</Link>
      
      <Button 
        onClick={() => userProxy.load()}
        loading={userProxy.loading}
      >
        Load User Data
      </Button>
      
      {userProxy.result && (
        <div>Welcome, {userProxy.result.name}!</div>
      )}
    </Box>
  );
};

render(<App />, document.querySelector("#root"));
```

## Philosophy

@jsenv/navi follows these core principles:

- **Simplicity over complexity** - Prefer simple, composable APIs
- **Standards compliance** - Leverage web platform APIs when possible  
- **Performance by default** - Optimize for bundle size and runtime performance
- **Developer experience** - Provide clear error messages and intuitive APIs
- **Accessibility first** - Ensure all components work with assistive technologies

## Architecture

The framework is built around three core concepts:

1. **Signals** - Reactive state primitives that automatically update the UI
2. **Actions** - Async operations with built-in lifecycle management  
3. **Components** - Composable UI building blocks with consistent APIs

This combination provides a powerful yet simple foundation for building interactive web applications that scale from simple pages to complex SPAs.

---

Ready to start your adventure? Check out the [component demos](src/) and [examples](../../../experiments/) to see @jsenv/navi in action.