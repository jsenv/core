// Test JSX component usage before component definition

// JSX usage before component definition
function App() {
  return <MyComponent title="Hello" extra="shouldWarn" />;
}

// Component definition after usage
function MyComponent({ title }) {
  return <div>{title}</div>;
}
