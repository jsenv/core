// Test wrapper with inline function expression - valid case
const ForwardRefInline = forwardRef(({ title, description }) => {
  return (
    <div>
      {title}: {description}
    </div>
  );
});

const MemoInline = memo(({ name, role }) => {
  return (
    <span>
      {name} - {role}
    </span>
  );
});

// Valid usage - all props are used
ForwardRefInline({ title: "Hello", description: "World" });
MemoInline({ name: "John", role: "Developer" });
