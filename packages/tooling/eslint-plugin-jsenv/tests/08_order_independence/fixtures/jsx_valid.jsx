// Test JSX component usage before component definition - valid case

// JSX usage before component definition
function App() {
  return <MyComponent title="Hello" />;
}

// Component definition after usage
function MyComponent({ title }) {
  return <div>{title}</div>;
}
