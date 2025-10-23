// Test forwardRef wrapper - valid case
function MyComponent({ title, description }) {
  return (
    <div>
      {title}: {description}
    </div>
  );
}

const WrappedComponent = forwardRef(MyComponent);

// Valid usage - all props are used by the wrapped component
WrappedComponent({ title: "Hello", description: "World" });
