/*
on veut pouvoir:
- mettre le terminal dans un "fake terminal" genre
avec le style de celui svg
- enregister une vidéo du terminal
ça faut que je regarde les apis canvas

https://github.com/welefen/canvas2video/blob/master/src/index.ts
https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream
https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
https://webglfundamentals.org/webgl/lessons/webgl-tips.html
https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts
*/

import "xterm";
import "xterm-addon-canvas";
import { createGifEncoder } from "./gif_encoder.js";

export const initTerminal = ({
  cols = 80,
  rows = 25,
  paddingLeft = 15,
  paddingRight = 15,
  fontFamily = "SauceCodePro Nerd Font, Source Code Pro, Courier",
  fontSize = 12,
  convertEol = true,
}) => {
  const { Terminal } = window;
  const { CanvasAddon } = window.CanvasAddon;
  const cssUrl = new URL("xterm/css/xterm.css", import.meta.url);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = cssUrl;
  document.head.appendChild(link);

  const term = new Terminal({
    convertEol,
    disableStdin: true,
    // cursorBlink: false,
    cursorInactiveStyle: "none",
    cols,
    rows,
    fontFamily,
    fontSize,
    // lineHeight: 18,
    theme: {
      background: "#282c34",
      foreground: "#abb2bf",
      selectionBackground: "#001122",
      selectionForeground: "#777777",
      brightRed: "#B22222",
      brightBlue: "#87CEEB",
    },
  });
  term.loadAddon(new CanvasAddon());
  const terminalElement = document.getElementById("terminal");
  term.open(terminalElement);

  const canvas = document.querySelector("#canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  const xtermCanvas = document.querySelector("canvas.xterm-text-layer");
  canvas.width = paddingLeft + xtermCanvas.width + paddingRight;
  canvas.height = 40 + xtermCanvas.height;

  draw_header: {
    drawRectangle(context, {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      fill: "#282c34",
      stroke: "rgba(255,255,255,0.35)",
      strokeWidth: 10,
      radius: 8,
    });
    drawCircle(context, {
      x: 20,
      y: 20,
      radius: 6,
      fill: "#ff5f57",
    });
    drawCircle(context, {
      x: 40,
      y: 20,
      radius: 6,
      fill: "#febc2e",
    });
    drawCircle(context, {
      x: 60,
      y: 20,
      radius: 6,
      fill: "#28c840",
    });

    // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text
    const text = "Terminal";
    context.font = `${fontSize}px ${fontFamily}`;
    context.textBaseline = "middle";
    context.textAlign = "center";
    // const textSize = context.measureText(text);
    context.fillStyle = "#abb2bf";
    context.fillText(text, canvas.width / 2, 20);
  }

  return {
    startRecording: async ({ mimeType = "video/webm;codecs=h264" } = {}) => {
      const gifEncoder = createGifEncoder({
        width: canvas.width,
        height: canvas.height,
      });
      gifEncoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
      gifEncoder.setDelay(0); // frame delay in ms // 500
      gifEncoder.setQuality(16); // [1,30] | Best=1 | >20 not much speed improvement. 10 is default.
      gifEncoder.start();

      const replicateXterm = () => {
        context.drawImage(
          xtermCanvas,
          0,
          0,
          xtermCanvas.width,
          xtermCanvas.height,
          paddingLeft,
          40,
          xtermCanvas.width,
          xtermCanvas.height,
        );

        gifEncoder.addFrame(context);
        gifEncoder.setDelay(0.02);

        const frameB64Str = canvas.toDataURL();
        document.querySelector("#gif_frames").innerHTML +=
          `<img src=${frameB64Str} width="150" />`;
      };

      const interval = setInterval(() => {}, 10); // setInterval(replicateXterm, 250);
      const stream = canvas.captureStream();
      const mediaRecorder = new MediaRecorder(stream, {
        videoBitsPerSecond: 2_500_000,
        mimeType,
      });
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) {
          chunks.push(e.data);
        }
      };
      const startPromise = new Promise((resolve) => {
        mediaRecorder.onstart = resolve;
      });
      mediaRecorder.start();
      await startPromise;

      return {
        writeIntoTerminal: (data) => {
          term.write(data);
          replicateXterm();
        },
        stopRecording: async () => {
          window.clearInterval(interval);
          replicateXterm();
          await new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
          const stopPromise = new Promise((resolve, reject) => {
            mediaRecorder.onstop = () => {
              resolve();
            };
            mediaRecorder.onerror = (e) => {
              reject(e);
            };
          });
          mediaRecorder.stop();
          await stopPromise;
          const blob = new Blob(chunks, {
            type: mediaRecorder.mimeType,
          });
          gifEncoder.finish();
          const gifBinaryString = gifEncoder.asBinaryString();
          const gifDataUrl = gifEncoder.asDataUrl();
          const videoBinaryString = await blobToBinaryString(blob);
          return {
            gifDataUrl,
            gifBinaryString,
            videoBinaryString,
          };
        },
      };
    },
  };
};

const drawRectangle = (
  context,
  { x, y, width, height, radius, fill, stroke, strokeWidth },
) => {
  if (radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, [radius]);
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke) {
      context.strokeWidth = strokeWidth;
      context.strokeStyle = stroke;
      context.stroke();
    }
  }
};
const drawCircle = (context, { x, y, radius, fill, stroke, borderWidth }) => {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI, false);
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  if (borderWidth) {
    context.lineWidth = 5;
  }
  if (stroke) {
    context.strokeStyle = stroke;
    context.stroke();
  }
};

const blobToBinaryString = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsBinaryString(blob);
  });
};
