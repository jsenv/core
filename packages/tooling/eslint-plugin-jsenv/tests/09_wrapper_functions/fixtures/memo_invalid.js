// Test memo wrapper - invalid case
function MyComponent({ name }) {
  return <div>Hello {name}</div>;
}

const MemoizedComponent = memo(MyComponent);

// Invalid usage - extra prop should be detected
MemoizedComponent({ name: "John", unused: "extra" });
