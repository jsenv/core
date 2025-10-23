// Test memo wrapper - valid case
function MyComponent({ name, age }) {
  return (
    <div>
      {name} is {age} years old
    </div>
  );
}

const MemoizedComponent = memo(MyComponent);

// Valid usage - all props are used by the wrapped component
MemoizedComponent({ name: "John", age: 25 });
