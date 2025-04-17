/*
 * TODO:
 *  - when there is an error while loading image draw a message on the canvas
 */

import { useDrawImage } from "hooks/use_draw_image.js";
import { useImageLoader } from "hooks/use_image_loader.js";
import { fromTransformations } from "matrix";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useMemo, useRef } from "preact/hooks";

export const Img = forwardRef(
  ({ name, source, width, height, onFirstDisplay, ...props }, ref) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    const imageAsCanvas = useImageCanvas(source, {
      width,
      height,
    });
    useDrawImage(innerRef.current, imageAsCanvas, {
      onFirstDraw: onFirstDisplay,
    });

    return (
      <canvas
        name={name}
        ref={innerRef}
        width={width}
        height={height}
        {...props}
        style={{
          width: "100%",
          height: "100%",
          ...props.style,
        }}
      />
    );
  },
);

export const useImageCanvas = (sourceArg, { name, width, height } = {}) => {
  let source;
  let sourceX;
  let sourceY;
  let sourceWidth;
  let sourceHeight;
  let sourceMirrorX;
  let sourceMirrorY;
  let sourceTransparentColor;

  if (isPlainObject(sourceArg)) {
    source = sourceArg.url || sourceArg.source;

    sourceX = sourceArg.x;
    if (sourceX === undefined) {
      sourceX = 0;
    } else {
      sourceX = parseInt(sourceX);
    }

    sourceY = sourceArg.y;
    if (sourceY === undefined) {
      sourceY = 0;
    } else {
      sourceY = parseInt(sourceY);
    }

    sourceWidth = sourceArg.width;
    sourceHeight = sourceArg.height;

    sourceTransparentColor = sourceArg.transparentColor;
    if (sourceTransparentColor === undefined) {
      sourceTransparentColor = [];
    } else if (typeof sourceTransparentColor[0] === "number") {
      sourceTransparentColor = [sourceTransparentColor];
    }

    sourceMirrorX = sourceArg.mirrorX;
    sourceMirrorY = sourceArg.mirrorY;
  }

  const [image] = useImageLoader(source);
  const [imageWidth, imageHeight] = getImageSize(image);
  if (width === undefined) {
    width = imageWidth;
  } else {
    width = parseInt(width);
  }
  if (height === undefined) {
    height = imageHeight;
  } else {
    height = parseInt(height);
  }
  if (sourceWidth === undefined) {
    sourceWidth = width;
  }
  if (sourceHeight === undefined) {
    sourceHeight = height;
  }

  const shouldReplace = useMemo(
    () => createShouldReplace(sourceTransparentColor),
    sourceTransparentColor.map((color) => `${color[0]}${color[1]}${color[2]}`),
  );

  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    if (!image) {
      return canvas;
    }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const transformations = {
      ...(sourceMirrorX || sourceMirrorY
        ? {
            flip: {
              x: sourceMirrorX,
              y: sourceMirrorY,
            },
            translate: {
              x: sourceMirrorX ? -parseInt(width) : 0,
              y: sourceMirrorY ? -parseInt(height) : 0,
            },
          }
        : {}),
    };
    const hasTransformations = Object.keys(transformations).length > 0;
    context.clearRect(0, 0, width, height);
    if (hasTransformations) {
      context.save();
      const matrix = fromTransformations(transformations);
      context.setTransform(...matrix);
      // context.setTransform(-1, 0, 0, 1, parseInt(width), 0);
    }
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
    if (hasTransformations) {
      context.restore();
    }
    if (shouldReplace) {
      const imageData = context.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      for (let i = 0, n = pixels.length; i < n; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (shouldReplace(r, g, b)) {
          pixels[i + 3] = 0;
        }
      }
      context.putImageData(imageData, 0, 0);
    }
    return canvas;
  }, [
    name,
    image,
    width,
    height,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    sourceMirrorX,
    sourceMirrorY,
    shouldReplace,
  ]);
};

const getImageSize = (object) => {
  if (object instanceof HTMLImageElement || object instanceof SVGImageElement) {
    return [object.naturalWidth, object.naturalHeight];
  }
  if (
    object instanceof HTMLCanvasElement ||
    object instanceof OffscreenCanvas
  ) {
    return [object.width, object.height];
  }
  return [undefined, undefined];
};

const createShouldReplace = (colorsToReplace) => {
  if (!colorsToReplace) {
    return null;
  }
  if (colorsToReplace.length === 0) {
    return null;
  }
  if (colorsToReplace.length === 1) {
    const colorToReplace = colorsToReplace[0];
    const rToReplace = parseInt(colorToReplace[0]);
    const gToReplace = parseInt(colorToReplace[1]);
    const bToReplace = parseInt(colorToReplace[2]);
    return (r, g, b) => {
      return r === rToReplace && g === gToReplace && b === bToReplace;
    };
  }
  return (r, g, b) => {
    return colorsToReplace.some((c) => {
      return r === c[0] && g === c[1] && b === c[2];
    });
  };
};

const isPlainObject = (obj) => {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return (
    Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null
  );
};
