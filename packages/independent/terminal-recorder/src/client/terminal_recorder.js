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
import "xterm-addon-webgl";
import { createGifEncoder } from "./gif_encoder.js";

const { Terminal } = window;
const { WebglAddon } = window.WebglAddon;

export const initTerminal = ({
  cols = 80,
  rows = 25,
  paddingLeft = 15,
  paddingRight = 15,
  fontFamily = "SauceCodePro Nerd Font, Source Code Pro, Courier",
  fontSize = 12,
  convertEol = true,
  gif,
  video,
  logs,
}) => {
  if (video === true) video = {};
  if (gif === true) gif = {};
  if (!video && !gif) {
    throw new Error("video or gif must be enabled");
  }

  const log = (...args) => {
    if (logs) {
      console.log(...args);
    }
  };

  log("init", { cols, rows, fontFamily, fontSize, convertEol, gif, video });

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
  term.loadAddon(
    new WebglAddon(
      // we pass true to enable preserveDrawingBuffer
      // it's not actually useful thanks to term.write callback +
      // call on _innerRefresh() before context.drawImage
      // but let's keep it nevertheless
      true,
    ),
  );
  const terminalElement = document.getElementById("terminal");
  term.open(terminalElement);

  const canvas = document.querySelector("#canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  const xtermCanvas = document.querySelector(
    "#terminal canvas.xterm-link-layer + canvas",
  );
  const headerHeight = 40;
  canvas.width = paddingLeft + xtermCanvas.width + paddingRight;
  canvas.height = headerHeight + xtermCanvas.height;

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
      y: headerHeight / 2,
      radius: 6,
      fill: "#ff5f57",
    });
    drawCircle(context, {
      x: 40,
      y: headerHeight / 2,
      radius: 6,
      fill: "#febc2e",
    });
    drawCircle(context, {
      x: 60,
      y: headerHeight / 2,
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
    context.fillText(text, canvas.width / 2, headerHeight / 2);
  }

  return {
    startRecording: async () => {
      const records = {};
      const frameCallbackSet = new Set();
      const stopCallbackSet = new Set();
      if (video) {
        log("start recording video");
        const { mimeType = "video/webm;codecs=h264", msAddedAtTheEnd } = video;
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error(`MediaRecorder does not support "${mimeType}"`);
        }
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
        log("starting media recorder");
        const startPromise = new Promise((resolve, reject) => {
          mediaRecorder.onstart = () => {
            resolve();
          };
          mediaRecorder.onerror = (e) => {
            log("media recorder error");
            reject(e);
          };
          mediaRecorder.start();
        });
        let timeout;
        let hasTimedout = false;
        const MS_ALLOCATED_TO_MEDIA_RECORDER = 2_000;
        await Promise.race([
          startPromise,
          new Promise((resolve) => {
            timeout = setTimeout(() => {
              hasTimedout = true;
              resolve();
            }, MS_ALLOCATED_TO_MEDIA_RECORDER);
          }),
        ]);
        if (hasTimedout) {
          throw new Error(
            `media recorder did not start in less than ${MS_ALLOCATED_TO_MEDIA_RECORDER}ms`,
          );
        }
        clearTimeout(timeout);
        log("media recorder started");

        stopCallbackSet.add(async () => {
          if (msAddedAtTheEnd) {
            await new Promise((resolve) => {
              setTimeout(resolve, msAddedAtTheEnd);
            });
            replicateXterm();
          } else {
            replicateXterm();
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 150);
          });
          await new Promise((resolve, reject) => {
            mediaRecorder.onstop = () => {
              resolve();
            };
            mediaRecorder.onerror = (e) => {
              reject(e);
            };
            mediaRecorder.stop();
          });
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
          const videoBinaryString = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsBinaryString(blob);
          });
          records.video = videoBinaryString;
        });
      }
      if (gif) {
        log("start recording gif");
        const { repeat = -1, quality, msAddedAtTheEnd } = gif;
        const gifEncoder = createGifEncoder({
          width: canvas.width,
          height: canvas.height,
          repeat: repeat === true ? 0 : repeat === false ? -1 : repeat,
          quality,
        });

        const startTime = Date.now();
        let previousTime = startTime;

        frameCallbackSet.add(() => {
          const now = Date.now();
          const msSincePreviousFrame = now - previousTime;
          previousTime = now;
          log(`add frame to gif with delay of ${msSincePreviousFrame}ms`);
          gifEncoder.addFrame(context, { delay: msSincePreviousFrame });
        });
        stopCallbackSet.add(async () => {
          if (msAddedAtTheEnd) {
            drawFrame();
            previousTime = Date.now() - msAddedAtTheEnd;
            drawFrame();
          } else {
            drawFrame();
          }
          gifEncoder.finish();
          log("gif recording stopped");
          const gifBinaryString = gifEncoder.readAsBinaryString();
          records.gif = gifBinaryString;
        });
        log("gif recorder started");
      }

      const drawFrame = () => {
        for (const frameCallback of frameCallbackSet) {
          frameCallback();
        }
      };

      const replicateXterm = () => {
        context.drawImage(
          xtermCanvas,
          0,
          0,
          xtermCanvas.width,
          xtermCanvas.height,
          paddingLeft,
          headerHeight,
          xtermCanvas.width,
          xtermCanvas.height,
        );
      };

      replicateXterm();
      drawFrame();

      return {
        writeIntoTerminal: async (data) => {
          await new Promise((resolve) => {
            log(`write data: "${data}"`);
            term.write(data, () => {
              term._core._renderService._renderDebouncer._innerRefresh();
              replicateXterm();
              drawFrame();
              resolve();
            });
          });
        },
        stopRecording: async () => {
          const promises = [];
          for (const stopCallback of stopCallbackSet) {
            promises.push(stopCallback());
          }
          await Promise.all(promises);
          return records;
        },
      };
    },
  };
};

const drawRectangle = (
  context,
  { x, y, width, height, radius, fill, stroke, strokeWidth },
) => {
  context.beginPath();
  if (radius) {
    context.roundRect(x, y, width, height, [radius]);
  } else {
    context.rect(x, y, width, height);
  }
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  if (stroke) {
    context.strokeWidth = strokeWidth;
    context.strokeStyle = stroke;
    context.stroke();
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
