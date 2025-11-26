import { Text } from "./text.jsx";

export const Code = (props) => {
  if (props.box) {
    return <CodeBox {...props} />;
  }
  return <Text as="code" {...props} />;
};

const CodeBox = ({ children, ...props }) => {
  return (
    <Text as="pre" {...props}>
      <Text as="code">{children}</Text>
    </Text>
  );
};
