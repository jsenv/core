// https://github.com/incubated-geek-cc/video-to-GIF/blob/main/js/GIFEncoder.js
// https://github.com/jnordberg/gif.js
// https://github.com/jnordberg/gif.js/blob/master/src/GIFEncoder.js

import { createNeuQuant } from "./neuquant.js";
import { createLzwEncoder } from "./lzw_encoder.js";

export const createGifEncoder = ({
  width,
  height,
  /*
   * Sets quality of color quantization (conversion of images to the maximum 256
   * colors allowed by the GIF specification). Lower values (minimum = 1)
   * produce better colors, but slow processing significantly. 10 is the
   * default, and produces good color mapping at reasonable speeds. Values
   * greater than 20 do not yield significant improvements in speed.
   */
  quality = 10,
  /**
   * Sets the number of times the set of GIF frames should be played.
   * -1 means no repeat, 0 means indefinitely
   *
   * int number of iterations.
   */
  repeat = -1,
  comment = "",
}) => {
  const byteArray = [];
  const writeByte = (data) => {
    byteArray.push(data);
  };
  const writeUTFBytes = (string) => {
    let i = 0;
    while (i < string.length) {
      writeByte(string.charCodeAt(i));
      i++;
    }
  };
  const writeBytes = (array, offset = 0, length = array.length) => {
    let i = offset;
    while (i < length) {
      writeByte(array[i]);
      i++;
    }
  };
  let charCodeMap;
  const fillCharCodes = () => {
    if (charCodeMap) {
      return;
    }
    charCodeMap = new Map();
    let i = 0;
    while (i < 256) {
      charCodeMap.set(i, String.fromCharCode(i));
      i++;
    }
  };
  const readAsBinaryString = () => {
    fillCharCodes();
    let binaryString = "";
    for (const byte of byteArray) {
      binaryString += charCodeMap.get(byte);
    }
    return binaryString;
  };

  let transparent = null; // transparent color if given
  let transIndex = 0; // transparent index in color table
  let colorDepth; // number of bit planes
  let usedEntry = []; // active palette entries
  let palSize = 7; // color table size (bits-1)
  let dispose = -1; // disposal code (-1 = use default
  let firstFrame = true;
  let finished = false;

  const writeShort = (pValue) => {
    writeByte(pValue & 0xff);
    writeByte((pValue >> 8) & 0xff);
  };

  const encoder = {
    /**
     * Sets the GIF frame disposal code for the last added frame and any
     * subsequent frames. Default is 0 if no transparent color has been set,
     * otherwise 2.
     * @param code
     * int disposal code.
     */
    setDispose: (code) => {
      if (code >= 0) dispose = code;
    },

    /**
     * Sets the transparent color for the last added frame and any subsequent
     * frames. Since all colors are subject to modification in the quantization
     * process, the color in the final palette for each frame closest to the given
     * color becomes the transparent color for that frame. May be set to null to
     * indicate no transparent color.
     * @param
     * Color to be treated as transparent on display.
     */
    setTransparent: (c) => {
      transparent = c;
    },

    /**
     * The addFrame method takes an incoming BitmapData object to create each frames
     * @param
     * BitmapData object to be treated as a GIF's frame
     */
    addFrame: (context, options) => {
      let delay = 0;
      if (options) {
        if (options.quality) {
          quality = options.quality < 1 ? 1 : options.quality;
        }
        if (options.delay) {
          delay = Math.round(options.delay / 10);
        }
      }

      const canvas = context.canvas;
      try {
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;

        const pixels = [];
        // build pixels
        {
          var count = 0;
          let y = 0;
          while (y < height) {
            let x = 0;
            while (x < width) {
              const b = y * width * 4 + x * 4;
              pixels[count++] = imageData[b];
              pixels[count++] = imageData[b + 1];
              pixels[count++] = imageData[b + 2];
              x++;
            }
            y++;
          }
        }
        let colorTab;
        let indexedPixels = [];
        // analyze pixels ( build color table & map pixels)
        {
          var len = pixels.length;
          var nPix = len / 3;
          const neuQuant = createNeuQuant({
            pixels,
            len,
            sample: quality,
          });

          // initialize quantizer
          colorTab = neuQuant.process(); // create reduced palette

          // map image pixels to new palette
          var k = 0;
          for (var j = 0; j < nPix; j++) {
            var index = neuQuant.map(
              pixels[k++] & 0xff,
              pixels[k++] & 0xff,
              pixels[k++] & 0xff,
            );
            usedEntry[index] = true;
            indexedPixels[j] = index;
          }

          pixels.length = 0;
          colorDepth = 8;
          palSize = 7;

          // get closest match to transparent color if specified
          if (transparent !== null) {
            /**
             * Returns index of palette color closest to c
             */
            const findClosest = (c) => {
              var r = (c & 0xff0000) >> 16;
              var g = (c & 0x00ff00) >> 8;
              var b = c & 0x0000ff;
              var minpos = 0;
              var dmin = 256 * 256 * 256;
              var len = colorTab.length;

              for (var i = 0; i < len; ) {
                var dr = r - (colorTab[i++] & 0xff);
                var dg = g - (colorTab[i++] & 0xff);
                var db = b - (colorTab[i] & 0xff);
                var d = dr * dr + dg * dg + db * db;
                var index = i / 3;
                if (usedEntry[index] && d < dmin) {
                  dmin = d;
                  minpos = index;
                }
                i++;
              }
              return minpos;
            };
            transIndex = colorTab === null ? -1 : findClosest(transparent);
          }
        }

        const writePalette = () => {
          writeBytes(colorTab);
          var n = 3 * 256 - colorTab.length;
          for (var i = 0; i < n; i++) writeByte(0);
        };

        if (firstFrame) {
          // write logical screen descriptior
          {
            // logical screen size
            writeShort(width);
            writeShort(height);
            // packed fields
            writeByte(
              0x80 | // 1 : global color table flag = 1 (gct used)
                0x70 | // 2-4 : color resolution = 7
                0x00 | // 5 : gct sort flag = 0
                palSize,
            ); // 6-8 : gct size

            writeByte(0); // background color index
            writeByte(0); // pixel aspect ratio - assume 1:1
          }

          // write palette
          writePalette(); // global color table

          // Writes Netscape application extension to define repeat count.
          if (repeat >= 0) {
            writeByte(0x21); // extension introducer
            writeByte(0xff); // app extension label
            writeByte(11); // block size
            writeUTFBytes("NETSCAPE2.0"); // app id + auth code
            writeByte(3); // sub-block size
            writeByte(1); // loop sub-block id
            writeShort(repeat); // loop count (extra iterations, 0=repeat forever)
            writeByte(0); // block terminator
          }
        }

        // write graphic control extension
        {
          writeByte(0x21); // extension introducer
          writeByte(0xf9); // GCE label
          writeByte(4); // data block size
          var transp;
          var disp;
          if (transparent === null) {
            transp = 0;
            disp = 0; // dispose = no action
          } else {
            transp = 1;
            disp = 2; // force clear if using transparent color
          }
          if (dispose >= 0) {
            disp = dispose & 7; // user override
          }
          disp <<= 2;
          // packed fields
          writeByte(
            0 | // 1:3 reserved
              disp | // 4:6 disposal
              0 | // 7 user input - 0 = none
              transp,
          ); // 8 transparency flag

          writeShort(delay); // delay x 1/100 sec
          writeByte(transIndex); // transparent color index
          writeByte(0); // block terminator
        }

        // write comment
        if (comment !== "") {
          writeByte(0x21); // extension introducer
          writeByte(0xfe); // comment label
          writeByte(comment.length); // Block Size (s)
          writeUTFBytes(comment);
          writeByte(0); // block terminator
        }

        // write image descriptor
        {
          writeByte(0x2c); // image separator
          writeShort(0); // image position x,y = 0,0
          writeShort(0);
          writeShort(width); // image size
          writeShort(height);

          // packed fields
          if (firstFrame) {
            // no LCT - GCT is used for first (or only) frame
            writeByte(0);
          } else {
            // specify normal LCT
            writeByte(
              0x80 | // 1 local color table 1=yes
                0 | // 2 interlace - 0=no
                0 | // 3 sorted - 0=no
                0 | // 4-5 reserved
                palSize,
            ); // 6-8 size of color table
          }
        }

        if (!firstFrame) {
          writePalette(); // local color table
        }
        colorTab = null;

        // encode and write pixel data
        {
          const lzwEncoder = createLzwEncoder({
            width,
            height,
            pixels: indexedPixels,
            colorDepth,
          });
          lzwEncoder.encode({
            writeByte,
            writeBytes,
          });
        }
        firstFrame = false;
        indexedPixels.length = 0;
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * Adds final trailer to the GIF stream, if you don't call the finish method
     * the GIF asDataUrl will not be valid.
     */
    finish: () => {
      if (finished) return false;
      finished = true;

      try {
        writeByte(0x3b); // gif trailer
        return true;
      } catch (e) {
        return false;
      }
    },

    readAsBinaryString,
    asDataUrl: () => {
      const gifAsBinaryString = readAsBinaryString();
      return `data:image/gif;base64,${encode64(gifAsBinaryString)}`;
    },
  };

  writeUTFBytes("GIF89a"); // header

  return encoder;
};

const encode64 = (input) => {
  let output = "";
  let i = 0;
  let l = input.length;
  let key = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let chr1;
  let chr2;
  let chr3;
  let enc1;
  let enc2;
  let enc3;
  let enc4;
  while (i < l) {
    chr1 = input.charCodeAt(i++);
    chr2 = input.charCodeAt(i++);
    chr3 = input.charCodeAt(i++);
    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = chr3 & 63;
    if (isNaN(chr2)) enc3 = enc4 = 64;
    else if (isNaN(chr3)) enc4 = 64;
    output =
      output +
      key.charAt(enc1) +
      key.charAt(enc2) +
      key.charAt(enc3) +
      key.charAt(enc4);
  }
  return output;
};
