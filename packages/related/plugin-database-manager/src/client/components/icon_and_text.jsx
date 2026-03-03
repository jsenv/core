import { Icon, Text } from "@jsenv/navi";

export const IconAndText = ({ icon, children }) => {
  return (
    <Text>
      <Icon>{icon}</Icon>
      {children}
    </Text>
  );
};
