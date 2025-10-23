// Test React.forwardRef and React.memo - valid case
function BaseComponent({ title, subtitle }) {
  return (
    <h1>
      {title} - {subtitle}
    </h1>
  );
}

const ReactForwardRefComponent = React.forwardRef(BaseComponent);
const ReactMemoComponent = React.memo(BaseComponent);

// Valid usage - all props are used by the wrapped components
ReactForwardRefComponent({ title: "Hello", subtitle: "World" });
ReactMemoComponent({ title: "React", subtitle: "Memo" });
