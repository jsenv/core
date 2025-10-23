// Test forwardRef wrapper - invalid case
function MyComponent({ title }) {
  return <div>{title}</div>;
}

const WrappedComponent = forwardRef(MyComponent);

// Invalid usage - extra prop should be detected
WrappedComponent({ title: "Hello", extra: "unused" });
