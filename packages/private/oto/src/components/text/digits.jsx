import { forwardRef } from "preact/compat";
import { Text } from "./text.jsx";

export const Digits = forwardRef(({ children, ...props }, ref) => {
  return (
    <Text
      ref={ref}
      color="white"
      fontFamily="goblin"
      // weight="bold"
      outlineColor="black"
      outlineSize={2}
      letterSpacing={2}
      lineHeight={1.4}
      {...props}
    >
      {children}
    </Text>
  );
});
