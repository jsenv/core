import { Text } from "./text.jsx";

export const Paragraph = (props) => {
  return <Text marginTop="md" {...props} as="p" {...props} />;
};
