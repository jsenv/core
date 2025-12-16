# @jsenv/navi

**@jsenv/navi** is a comprehensive frontend framework designed to simplify navigation, state management, and UI development. Named after Navi, the fairy guide from Zelda, it helps you navigate through the complexities of building modern web applications.

## What it provides

### 🧭 Navigation

- **Client-side routing** with URL synchronization
- **Link components** that enhance standard anchor tags
- **History management** and navigation state
- **Route-based code splitting** and lazy loading

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
