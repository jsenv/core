// Test JSX component usage before component definition - invalid case

// JSX usage before component definition with extra prop
function App() {
  return <MyComponent title="Hello" extra="shouldWarn" />;
}

// Component definition after usage
function MyComponent({ title }) {
  return <div>{title}</div>;
}
