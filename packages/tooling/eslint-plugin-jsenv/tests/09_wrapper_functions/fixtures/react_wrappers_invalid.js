// Test React.forwardRef and React.memo - invalid case
function BaseComponent({ title }) {
  return <h1>{title}</h1>;
}

const ReactForwardRefComponent = React.forwardRef(BaseComponent);
const ReactMemoComponent = React.memo(BaseComponent);

// Invalid usage - extra props should be detected
ReactForwardRefComponent({ title: "Hello", extra1: "unused" });
ReactMemoComponent({ title: "React", extra2: "unused" });
