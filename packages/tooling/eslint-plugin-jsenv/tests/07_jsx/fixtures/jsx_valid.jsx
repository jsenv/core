// Define components first
const Toto = ({ a }) => {
  console.log(a);
  return null;
};

const ComponentWithRest = ({ a, ...rest }) => {
  console.log(a, rest);
  return null;
};

// Valid: JSX component with matching props
export const ValidComponent = () => {
  return <Toto a={1} />;
};

// Valid: JSX with rest props
export const ValidWithRest = () => {
  return <ComponentWithRest a={1} b={2} />;
};
