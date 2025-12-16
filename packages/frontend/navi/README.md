# @jsenv/navi

> ⚠️ **Work in Progress** - This framework is being actively developed and APIs may change.

> Helps to build modern web application

**@jsenv/navi** is a comprehensive frontend framework designed to simplify navigation, state management, and UI development. Named after Navi, the fairy guide from Zelda, it helps you navigate through the complexities of building modern web applications.

## What it provides

### 🧭 Navigation & Routing

- **Client-side routing** with URL synchronization and code splitting
- **Link components** that enhance standard anchor tags
- **Route components** with nested routing support
- **History management** and navigation state hooks
- **Keyboard navigation** with keyboard shortcuts

### 🔄 State Management & Actions

- **Signal-based reactive state** with local storage integration
- **Action system** for async operations with lifecycle management
- **Resource management** with caching and request deduplication
- **Form validation** with custom constraints and real-time feedback
- **State synchronization** utilities and debugging tools

### 🎨 UI Components

#### Form & Input Controls

- **Input, Button, Label** - Enhanced form elements with validation
- **Radio/RadioList, Checkbox/CheckboxList** - Selection controls with icons and custom appearances
- **Select, Form** - Complete form building blocks
- **Field validation** with constraint validation API integration
- **Editable components** with inline editing capabilities

#### Data Visualization

- **Table** - Complete table system with selection, sorting, and column management
- **Selection system** - Multi-selection with keyboard shortcuts
- **Error boundaries** - Graceful error handling components

#### Layout & Structure

- **Box** - Flexible layout container with spacing and alignment
- **Details** - Collapsible content with navigation state persistence
- **Dialog, Viewport layouts** - Modal and full-screen layouts
- **Separator** - Visual content dividers
- **UI Transitions** - Smooth component transitions

#### Typography & Graphics

- **Text, Title, Paragraph** - Typography components with theming
- **Code, Caption** - Specialized text displays
- **Icon, Image, Svg** - Graphics with built-in icon library
- **Badge, MessageBox** - Status and notification displays
- **Address** - Semantic contact information component

#### Interactive Features

- **Keyboard shortcuts** - Global and component-level hotkeys
- **Focus management** - Accessibility-focused navigation
- **Callouts & popovers** - Contextual overlays and tooltips
- **Copy to clipboard** - One-click content copying

## Quick Example

```jsx
import { render } from "preact";
import { Link, Button, Box } from "@jsenv/navi";

const userSignal = signal();
const requestUser = async ({ id }) => {
  const response = await fetch(`/api/users/${id}`);
  const user = response.json();
  userSignal.value = user;
};

const App = () => {
  const user = userSignal.value;

  return (
    <Box row spacing="lg">
      <Link href="/profile">Go to Profile</Link>

      <Button
        action={async () => {
          await requestUser();
        }}
      >
        Load User Data
      </Button>

      {user && <div>Welcome, {user.name}!</div>}
    </Box>
  );
};

render(<App />, document.querySelector("#root"));
```

## Architecture

The framework is built around three core concepts:

1. **Signals** - Reactive state primitives that automatically update the UI
2. **Actions** - Async operations with built-in lifecycle management
3. **Components** - Composable UI building blocks with consistent APIs

This combination provides a powerful yet simple foundation for building interactive web applications that scale from simple pages to complex SPAs.
