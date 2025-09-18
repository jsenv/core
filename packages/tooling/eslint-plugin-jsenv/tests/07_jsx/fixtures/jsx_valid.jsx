// Valid: JSX component with matching props
export const ValidComponent = () => {
  return <Toto a={1} />;
};

const Toto = ({ a }) => {
  console.log(a);
  return null;
};

// Valid: JSX with rest props
export const ValidWithRest = () => {
  return <ComponentWithRest a={1} b={2} />;
};

const ComponentWithRest = ({ a, ...rest }) => {
  console.log(a, rest);
  return null;
};
