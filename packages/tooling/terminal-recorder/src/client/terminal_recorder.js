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

import { FitAddon } from "@xterm/addon-fit";
import { SerializeAddon } from "@xterm/addon-serialize";
// see https://github.com/microsoft/playwright/issues/30585 which is a problem for mac os 14
import { WebglAddon } from "@xterm/addon-webgl"; // https://github.com/xtermjs/xterm.js/tree/master/addons/addon-webgl
import { Terminal } from "@xterm/xterm";
import { createGifEncoder } from "./gif_encoder.js";

export const initTerminal = ({
  cols = 80,
  rows = 25,
  paddingLeft = 15,
  paddingRight = 15,
  fontFamily = "SauceCodePro Nerd Font, Source Code Pro, Courier",
  fontSize = 12,
  convertEol = true,
  textInViewport,
  gif,
  video,
  logs,
}) => {
  if (textInViewport === true) textInViewport = {};
  if (gif === true) gif = {};
  if (video === true) video = {};
  if (!textInViewport && !video && !gif) {
    throw new Error("ansi, video or gif must be enabled");
  }

  const log = (...args) => {
    if (logs) {
      console.log(...args);
    }
  };

  log("init", { cols, rows, fontFamily, fontSize, convertEol, gif, video });

  const cssUrl = new URL("@xterm/xterm/css/xterm.css", import.meta.url);
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
  const serializeAddon = new SerializeAddon();
  term.loadAddon(serializeAddon);
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  const webglAddon = new WebglAddon(
    // we pass true to enable preserveDrawingBuffer
    // it's not actually useful thanks to term.write callback +
    // call on _innerRefresh() before context.drawImage
    // but let's keep it nevertheless
    true,
  );
  term.loadAddon(webglAddon);
  const terminalElement = document.querySelector("#terminal");
  term.open(terminalElement);
  fitAddon.fit();

  const canvas = document.querySelector("#canvas");
  if (!canvas) {
    throw new Error('Cannot find <canvas id="canvas"> in the document');
  }
  const xTermCanvasSelector = "#terminal canvas.xterm-link-layer + canvas";
  const xtermCanvas = document.querySelector(xTermCanvasSelector);
  if (!xtermCanvas) {
    throw new Error(`Cannot find xterm canvas (${xTermCanvasSelector})`);
  }

  return {
    term,
    startRecording: async () => {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.imageSmoothingEnabled = true;
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

      const records = {};
      let writePromise = Promise.resolve();
      const frameCallbackSet = new Set();
      const stopCallbackSet = new Set();
      if (textInViewport) {
        log("start recording text in viewport");
        // https://github.com/xtermjs/xterm.js/issues/3681
        // https://github.com/xtermjs/xterm.js/issues/3681
        // get the first line
        // term.buffer.active.getLine(term.buffer.active.viewportY).translateToString()
        // get the last line
        // term.buffer.active.getLine(term.buffer.active.length -1).translateToString()
        // https://github.com/xtermjs/xterm.js/blob/a7952ff36c60ee6dce9141744b1355a5d582ee39/addons/addon-serialize/src/SerializeAddon.ts
        stopCallbackSet.add(() => {
          const startY = term.buffer.active.viewportY;
          const endY = term.buffer.active.length - 1;
          const range = {
            start: startY,
            end: endY,
          };
          log(`lines in viewport: ${startY}:${endY}`);
          const output = serializeAddon.serialize({
            range,
          });
          log(`text in viewport: ${output}`);
          records.textInViewport = output;
        });
      }
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
        frameCallbackSet.add(({ delay }) => {
          log(`add frame to gif with delay of ${delay}ms`);
          gifEncoder.addFrame(context, { delay });
        });
        stopCallbackSet.add(async () => {
          const now = Date.now();
          drawFrame({
            delay: now - previousTime,
          });
          if (msAddedAtTheEnd) {
            drawFrame({
              delay: now - msAddedAtTheEnd,
            });
          }
          gifEncoder.finish();
          log("gif recording stopped");
          const gifBinaryString = gifEncoder.readAsBinaryString();
          records.gif = gifBinaryString;
        });
        log("gif recorder started");
      }

      const startTime = Date.now();
      let previousTime = startTime;
      let isFirstDraw = true;
      const drawFrame = (options) => {
        for (const frameCallback of frameCallbackSet) {
          frameCallback(options);
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

      return {
        writeIntoTerminal: async (data, options = {}) => {
          if (isFirstDraw) {
            isFirstDraw = false;
            drawFrame({ delay: 0 });
          }
          let { delay } = options;
          if (delay === undefined) {
            const now = Date.now();
            delay = now - previousTime;
          }
          writePromise = new Promise((resolve) => {
            log(`write data:`, data);
            term.write(data, () => {
              term._core._renderService._renderDebouncer._innerRefresh();
              replicateXterm();
              drawFrame({ delay });
              resolve();
            });
          });
          await writePromise;
        },
        stopRecording: async () => {
          await writePromise;
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
