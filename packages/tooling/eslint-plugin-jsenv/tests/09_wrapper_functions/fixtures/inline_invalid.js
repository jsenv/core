// Test wrapper with inline function expression - invalid case
const ForwardRefInline = forwardRef(({ title }) => {
  return <div>{title}</div>;
});

const MemoInline = memo(({ name }) => {
  return <span>{name}</span>;
});

// Invalid usage - extra props should be detected
ForwardRefInline({ title: "Hello", extra1: "unused" });
MemoInline({ name: "John", extra2: "unused" });
