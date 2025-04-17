import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { getDomElementBox } from "/utils/get_dom_element_box.js";

export const SelectionRectangle = ({ drawZoneRef, enabled }) => {
  const selectionRectangleCanvasRef = useRef();

  const [offsetLeft, offsetLeftSetter] = useState(0);
  const [offsetTop, offsetTopSetter] = useState(0);
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    const drawZone = drawZoneRef.current;
    const { left, top } = getDomElementBox(drawZone);
    offsetLeftSetter(left);
    offsetTopSetter(top);
  }, [enabled]);

  const [scrollLeft, scrollLeftSetter] = useState(0);
  const [scrollTop, scrollTopSetter] = useState(0);
  useLayoutEffect(() => {
    if (!enabled) {
      return null;
    }
    const drawZone = drawZoneRef.current;
    const updateScrolls = () => {
      scrollLeftSetter(drawZone.scrollLeft);
      scrollTopSetter(drawZone.scrollTop);
    };
    updateScrolls();
    const onscroll = () => {
      updateScrolls();
    };
    drawZone.addEventListener("scroll", onscroll, { passive: true });
    return () => {
      drawZone.removeEventListener("scroll", onscroll, { passive: true });
    };
  }, [enabled]);

  const [interactedOnce, interactedOnceSetter] = useState(false);
  const [mouseIsDown, mouseIsDownSetter] = useState(false);
  const [mouseClientX, mouseClientXSetter] = useState(0);
  const [mouseClientY, mouseClientYSetter] = useState(0);
  const mouseXRelativeToParent = mouseClientX - offsetLeft + scrollLeft;
  const mouseYRelativeToParent = mouseClientY - offsetTop + scrollTop;
  const mousedownInfoRef = useRef();
  useEffect(() => {
    if (!enabled) {
      return null;
    }
    const drawZone = drawZoneRef.current;
    const onmousedown = (e) => {
      mouseIsDownSetter(true);
      interactedOnceSetter(true);
      e.preventDefault();
      const { clientX, clientY } = e;
      mousedownInfoRef.current = {
        clientX,
        clientY,
      };
      mouseClientXSetter(clientX);
      mouseClientYSetter(clientY);
    };
    const onmousemove = (e) => {
      const { clientX, clientY } = e;
      mouseClientXSetter(clientX);
      mouseClientYSetter(clientY);
    };
    const onmouseup = () => {
      mouseIsDownSetter(false);
      mousedownInfoRef.current = null;
    };
    drawZone.addEventListener("mousedown", onmousedown);
    document.addEventListener("mousemove", onmousemove);
    document.addEventListener("mouseup", onmouseup);
    return () => {
      drawZone.removeEventListener("mousedown", onmousedown);
      document.removeEventListener("mousemove", onmousemove);
      document.removeEventListener("mouseup", onmouseup);
    };
  }, [enabled]);

  const [mouseInsideDrawZone, mouseInsideDrawZoneSetter] = useState(false);
  useEffect(() => {
    if (!enabled) {
      return null;
    }
    const drawZone = drawZoneRef.current;
    const onmouseenter = () => {
      mouseInsideDrawZoneSetter(true);
    };
    const onmouseleave = () => {
      mouseInsideDrawZoneSetter(false);
    };
    drawZone.addEventListener("mouseenter", onmouseenter);
    drawZone.addEventListener("mouseleave", onmouseleave);
    return () => {
      drawZone.removeEventListener("mouseenter", onmouseenter);
      drawZone.removeEventListener("mouseleave", onmouseleave);
    };
  }, [enabled]);

  let x;
  let y;
  let width;
  let height;
  const mousedownInfo = mousedownInfoRef.current;
  if (mousedownInfo) {
    const startClientX = mousedownInfo.clientX;
    const startClientY = mousedownInfo.clientY;
    const moveX = mouseClientX - startClientX;
    const moveY = mouseClientY - startClientY;
    const startX = startClientX - offsetLeft + scrollLeft;
    const startY = startClientY - offsetTop + scrollTop;
    if (moveX === 0 && moveY === 0) {
      x = startX;
      y = startY;
      width = 1;
      height = 1;
    } else {
      if (mouseClientX > startClientX) {
        x = startX;
        width = moveX;
      } else {
        x = startX + moveX;
        width = -moveX;
      }
      if (mouseClientY > startClientY) {
        y = startY;
        height = moveY;
      } else {
        y = startY + moveY;
        height = -moveY;
      }
    }
  }

  useLayoutEffect(() => {
    const selectionRectangleCanvas = selectionRectangleCanvasRef.current;
    const context = selectionRectangleCanvas.getContext("2d");
    selectionRectangleCanvas.width =
      selectionRectangleCanvas.parentNode.scrollWidth;
    selectionRectangleCanvas.height =
      selectionRectangleCanvas.parentNode.scrollHeight;
    context.clearRect(
      0,
      0,
      selectionRectangleCanvas.width,
      selectionRectangleCanvas.height,
    );
    if (!enabled) {
      return;
    }
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.globalAlpha = 0.8;
    context.lineWidth = 3;
    context.strokeStyle = "orange";
    context.stroke();
    context.closePath();
    context.restore();
  }, [enabled, x, y, width, height]);

  return (
    <>
      <div
        name="mouse_xy"
        style={{
          display:
            enabled && !mouseIsDown && mouseInsideDrawZone ? "block" : "none",
          position: "absolute",
          left: `${mouseXRelativeToParent + 15}px`,
          top: `${mouseYRelativeToParent + 15}px`,
          fontSize: "10px",
        }}
      >
        <span style={{ backgroundColor: "white" }}>
          {mouseXRelativeToParent}
        </span>
        <br />
        <span style={{ backgroundColor: "white" }}>
          {mouseYRelativeToParent}
        </span>
      </div>
      <div
        name="rectangle_xy"
        style={{
          display: enabled && interactedOnce ? "block" : "none",
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          fontSize: "10px",
        }}
      >
        <span style={{ backgroundColor: "white" }}>{x}</span>
        <br />
        <span style={{ backgroundColor: "white" }}>{y}</span>
      </div>
      <div
        name="rectangle_size"
        style={{
          display: enabled && interactedOnce ? "block" : "none",
          position: "absolute",
          left: `${x + width}px`,
          top: `${y + height}px`,
          fontSize: "10px",
        }}
      >
        <span style={{ backgroundColor: "white" }}>{width}</span>
        <br />
        <span style={{ backgroundColor: "white" }}>{height}</span>
      </div>
      <canvas
        name="rectangle_selection"
        ref={selectionRectangleCanvasRef}
        style={{
          pointerEvents: "none",
          position: "absolute",
          left: "0",
          top: "0",
        }}
      ></canvas>
    </>
  );
};
