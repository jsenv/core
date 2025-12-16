import { Box } from "oto/src/components/box/box_oto.jsx";
import { Message } from "oto/src/components/message/message.jsx";
import { HOVER_TEXT_COLOR } from "oto/src/globals/colors.js";
import { useState } from "preact/hooks";
import "./button.css" with { type: "css" };

export const Button = ({ children, color, ...props }) => {
  const [hovered, hoveredSetter] = useState(false);

  return (
    <Box.button
      onMouseEnter={() => {
        hoveredSetter(true);
      }}
      onMouseLeave={() => {
        hoveredSetter(false);
      }}
      color={hovered ? HOVER_TEXT_COLOR : color}
      {...props}
    >
      {children}
    </Box.button>
  );
};

export const ButtonMessage = ({ children, width, height, ...props }) => {
  return (
    <Button
      color="white"
      cursor="pointer"
      width={width}
      height={height}
      {...props}
    >
      <Message width={width} height={height} cursor="pointer" color="inherit">
        {children}
      </Message>
    </Button>
  );
};
