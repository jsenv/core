import { Text } from "./text.jsx";

export const Address = ({ children, ...props }) => {
  return (
    <Text as="address" {...props}>
      {children}
    </Text>
  );
};
