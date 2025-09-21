// Invalid: JSX component with extra props
export const Tata = () => {
  return <Toto b={true} />;
};

const Toto = ({ a }) => {
  console.log(a);
  return null;
};

// Invalid: Multiple extra props in JSX
export const MultipleExtraProps = () => {
  return <Button label="Click" disabled={true} size="large" />;
};

const Button = ({ label }) => {
  return <button>{label}</button>;
};

const ComponentWithoutProps = () => {
  return null;
};
export const Compi = () => {
  return <ComponentWithoutProps extra="value" another="value2" />;
};
