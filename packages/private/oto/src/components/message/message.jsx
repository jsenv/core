import { forwardRef } from "preact/compat";
import { Box, borderWithStroke } from "/components/box/box.jsx";
import { Text } from "/components/text/text.jsx";

const MessageComponent = (
  {
    name,
    backgroundColor = "black",
    color = "white",
    borderColor = "white",
    borderStrokeColor = "black",
    borderSize = 5,
    borderStrokeSize = 1,
    borderRadius = 5,
    textOutlineColor = "black",
    overflow,
    textController,
    onClick,
    children,
    ...props
  },
  ref,
) => {
  return (
    <Box
      x="center"
      y="center"
      height="100%"
      innerSpacing="0.4em"
      maxWidth="100%"
      cursor={onClick ? undefined : "default"}
      backgroundColor={backgroundColor}
      border={borderWithStroke({
        color: borderColor,
        size: borderSize,
        strokeColor: borderStrokeColor,
        strokeSize: borderStrokeSize,
        radius: borderRadius,
      })}
      onClick={onClick}
      {...props}
      style={{
        userSelect: "none",
        ...props.style,
      }}
    >
      <Text
        name={name}
        ref={ref}
        controller={textController}
        color={color}
        outlineColor={textOutlineColor}
        overflow={overflow}
      >
        {children}
      </Text>
    </Box>
  );
};

export const Message = forwardRef(MessageComponent);
