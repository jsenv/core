// we'll hve an issue if the thing is rectangular
// because the x/y will not be a square so the canvas
// width/height should be respected
// and we might want to draw it differently
import { useLayoutEffect, useRef } from "preact/hooks";

export const Selector = ({
  hidden,
  color = "dodgerblue",
  outlineColor = "black",
  ...props
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const canvas = ref.current;
    const context = canvas.getContext("2d");
    context.beginPath();

    context.lineWidth = 1;
    buildPath(context);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.closePath();
    context.strokeColor = outlineColor;
    context.stroke();
    context.fillStyle = color;
    context.fill();
  }, [color, outlineColor]);

  return (
    <div
      {...props}
      style={{
        ...props.style,
        position: "absolute",
        cursor: hidden ? "" : "pointer",
        visibility: hidden ? "hidden" : "",
        pointerEvents: hidden ? "none" : "auto",
        left: "-10px",
        top: "-10px",
        right: "-10px",
        bottom: "-10px",
      }}
    >
      <canvas
        ref={ref}
        width="100"
        height="100"
        style={{
          width: "100%",
          height: "100%",
        }}
      ></canvas>
    </div>
  );
};

const buildPath = (context) => {
  let x;
  let y;
  const moveTo = (_x, _y) => {
    x = _x;
    y = _y;
    context.moveTo(x, y);
  };
  const lineX = (_x) => {
    x = _x;
    context.lineTo(x, y);
  };
  const lineY = (_y) => {
    y = _y;
    context.lineTo(x, y);
  };

  const size = 5;
  const length = 15;
  const lineWidth = context.lineWidth;
  // const radius = 2;

  top_left_path: {
    // start top left
    moveTo(lineWidth, 2);
    // draw left line
    lineY(y + length);
    // draw bottom line
    lineX(x + size);
    // draw right line
    lineY(size + lineWidth * 2);
    // draw border "radius"
    lineX(x + 1);
    lineY(y - 1);
    lineX(x + length - size);
    lineY(lineWidth);
    lineX(2);
    lineY(y + 1);
    lineX(lineWidth);
  }

  top_right_path: {
    // start top left of the top right thing
    moveTo(100 - length, lineWidth);
    lineX(x + length - 2);
    lineY(y + 1);
    lineX(x + 1);
    lineY(y + length);
    lineX(x - size);
    lineY(size + lineWidth * 2);
    lineX(x - 1);
    lineY(y - 1);
    lineX(100 - length);
    lineY(lineWidth);
  }

  bottom_right_path: {
    // start top right of the bottom right cordner
    moveTo(100 - lineWidth, 100 - lineWidth - length + 1);
    lineY(y + length - 2);
    lineX(x - 1);
    lineY(y + 1);
    lineX(x - length + 1);
    lineY(y - size);
    lineX(x + length - size - 1);
    lineY(y - 1);
    lineX(x + 1);
    lineY(y - length + size + 2);
    lineX(x + size);
  }

  bottom_left_path: {
    // start bottom right of the bottom left corner
    moveTo(lineWidth * 2 + length, 100 - lineWidth);
    lineX(lineWidth + 1);
    lineY(y - 1);
    lineX(x - 1);
    lineY(y - length);
    lineX(x + size);
    lineY(y + length - size);
    lineX(x + 1);
    lineY(y + 1);
    lineX(x + length - size - 1);
    lineY(100 - lineWidth);
  }
};
