import { BadgeCount, Text } from "@jsenv/navi";

export const TextAndCount = ({ text, count }) => (
  <Text>
    {text} <BadgeCount>{count}</BadgeCount>
  </Text>
);
