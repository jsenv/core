// Define components first
const Toto = ({ a }) => {
  console.log(a);
  return null;
};

const Button = ({ label }) => {
  return <button>{label}</button>;
};

// Invalid: JSX component with extra props
export const Tata = () => {
  return <Toto b={true} />;
};

// Invalid: Multiple extra props in JSX
export const MultipleExtraProps = () => {
  return <Button label="Click" disabled={true} size="large" />;
};
