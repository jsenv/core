import "/jsenv_terminal_recorder_node_modules.js";

const createLzwEncoder = ({ width, height, pixels, colorDepth }) => {
  var EOF = -1;
  var imgW;
  var imgH;
  var pixAry;
  var initCodeSize;
  var remaining;
  var curPixel;

  // GIFCOMPR.C - GIF Image compression routines
  // Lempel-Ziv compression based on 'compress'. GIF modifications by
  // David Rowley (mgardi@watdcsu.waterloo.edu)
  // General DEFINEs

  var BITS = 12;
  var HSIZE = 5003; // 80% occupancy

  // GIF Image compression - modified 'compress'
  // Based on: compress.c - File compression ala IEEE Computer, June 1984.
  // By Authors: Spencer W. Thomas (decvax!harpo!utah-cs!utah-gr!thomas)
  // Jim McKie (decvax!mcvax!jim)
  // Steve Davies (decvax!vax135!petsd!peora!srd)
  // Ken Turkowski (decvax!decwrl!turtlevax!ken)
  // James A. Woods (decvax!ihnp4!ames!jaw)
  // Joe Orost (decvax!vax135!petsd!joe)

  var n_bits; // number of bits/code
  var maxbits = BITS; // user settable max # bits/code
  var maxcode; // maximum code, given n_bits
  var maxmaxcode = 1 << BITS; // should NEVER generate this code
  var htab = [];
  var codetab = [];
  var hsize = HSIZE; // for dynamic table sizing
  var free_ent = 0; // first unused entry

  // block compression parameters -- after all codes are used up,
  // and compression rate changes, start over.

  var clear_flg = false;

  // Algorithm: use open addressing double hashing (no chaining) on the
  // prefix code / next character combination. We do a variant of Knuth's
  // algorithm D (vol. 3, sec. 6.4) along with G. Knott's relatively-prime
  // secondary probe. Here, the modular division first probe is gives way
  // to a faster exclusive-or manipulation. Also do block compression with
  // an adaptive reset, whereby the code table is cleared when the compression
  // ratio decreases, but after the table fills. The variable-length output
  // codes are re-sized at this point, and a special CLEAR code is generated
  // for the decompressor. Late addition: construct the table according to
  // file size for noticeable speed improvement on small files. Please direct
  // questions about this implementation to ames!jaw.

  var g_init_bits;
  var ClearCode;
  var EOFCode;

  // output
  // Output the given code.
  // Inputs:
  // code: A n_bits-bit integer. If == -1, then EOF. This assumes
  // that n_bits =< wordsize - 1.
  // Outputs:
  // Outputs code to the file.
  // Assumptions:
  // Chars are 8 bits long.
  // Algorithm:
  // Maintain a BITS character long buffer (so that 8 codes will
  // fit in it exactly). Use the VAX insv instruction to insert each
  // code in turn. When the buffer fills up empty it and start over.

  var cur_accum = 0;
  var cur_bits = 0;
  var masks = [
    0x0000, 0x0001, 0x0003, 0x0007, 0x000f, 0x001f, 0x003f, 0x007f, 0x00ff,
    0x01ff, 0x03ff, 0x07ff, 0x0fff, 0x1fff, 0x3fff, 0x7fff, 0xffff,
  ];

  // Number of characters so far in this 'packet'
  var a_count;

  // Define the storage for the packet accumulator
  var accum = [];

  imgW = width;
  imgH = height;
  pixAry = pixels;
  initCodeSize = Math.max(2, colorDepth);

  // Add a character to the end of the current packet, and if it is 254
  // characters, flush the packet to disk.
  const char_out = (c, outs) => {
    accum[a_count++] = c;
    if (a_count >= 254) flush_char(outs);
  };

  // Clear out the hash table
  // table clear for block compress
  const cl_block = (outs) => {
    cl_hash(hsize);
    free_ent = ClearCode + 2;
    clear_flg = true;
    output(ClearCode, outs);
  };

  // reset code table
  const cl_hash = (hsize) => {
    for (var i = 0; i < hsize; ++i) htab[i] = -1;
  };

  // Flush the packet to disk, and reset the accumulator
  const flush_char = (outs) => {
    if (a_count > 0) {
      outs.writeByte(a_count);
      outs.writeBytes(accum, 0, a_count);
      a_count = 0;
    }
  };

  const MAXCODE = (n_bits) => {
    return (1 << n_bits) - 1;
  };

  // ----------------------------------------------------------------------------
  // Return the next pixel from the image
  // ----------------------------------------------------------------------------

  const nextPixel = () => {
    if (remaining === 0) return EOF;
    --remaining;
    var pix = pixAry[curPixel++];
    return pix & 0xff;
  };

  const output = (code, outs) => {
    cur_accum &= masks[cur_bits];

    if (cur_bits > 0) cur_accum |= code << cur_bits;
    else cur_accum = code;

    cur_bits += n_bits;

    while (cur_bits >= 8) {
      char_out(cur_accum & 0xff, outs);
      cur_accum >>= 8;
      cur_bits -= 8;
    }

    // If the next entry is going to be too big for the code size,
    // then increase it, if possible.

    if (free_ent > maxcode || clear_flg) {
      if (clear_flg) {
        maxcode = MAXCODE((n_bits = g_init_bits));
        clear_flg = false;
      } else {
        ++n_bits;
        if (n_bits === maxbits) maxcode = maxmaxcode;
        else maxcode = MAXCODE(n_bits);
      }
    }

    if (code === EOFCode) {
      // At EOF, write the rest of the buffer.
      while (cur_bits > 0) {
        char_out(cur_accum & 0xff, outs);
        cur_accum >>= 8;
        cur_bits -= 8;
      }

      flush_char(outs);
    }
  };

  const lzwencoder = {
    compress: (init_bits, outs) => {
      var fcode;
      var i; /* = 0 */
      var c;
      var ent;
      var disp;
      var hsize_reg;
      var hshift;

      // Set up the globals: g_init_bits - initial number of bits
      g_init_bits = init_bits;

      // Set up the necessary values
      clear_flg = false;
      n_bits = g_init_bits;
      maxcode = MAXCODE(n_bits);

      ClearCode = 1 << (init_bits - 1);
      EOFCode = ClearCode + 1;
      free_ent = ClearCode + 2;

      a_count = 0; // clear packet

      ent = nextPixel();

      hshift = 0;
      for (fcode = hsize; fcode < 65536; fcode *= 2) ++hshift;
      hshift = 8 - hshift; // set hash code range bound

      hsize_reg = hsize;
      cl_hash(hsize_reg); // clear hash table

      output(ClearCode, outs);

      outer_loop: while ((c = nextPixel()) !== EOF) {
        fcode = (c << maxbits) + ent;
        i = (c << hshift) ^ ent; // xor hashing

        if (htab[i] === fcode) {
          ent = codetab[i];
          continue;
        } else if (htab[i] >= 0) {
          // non-empty slot

          disp = hsize_reg - i; // secondary hash (after G. Knott)
          if (i === 0) disp = 1;

          do {
            if ((i -= disp) < 0) i += hsize_reg;

            if (htab[i] === fcode) {
              ent = codetab[i];
              continue outer_loop;
            }
          } while (htab[i] >= 0);
        }

        output(ent, outs);
        ent = c;
        if (free_ent < maxmaxcode) {
          codetab[i] = free_ent++; // code -> hashtable
          htab[i] = fcode;
        } else cl_block(outs);
      }

      // Put out the final code.
      output(ent, outs);
      output(EOFCode, outs);
    },
    encode: (os) => {
      os.writeByte(initCodeSize); // write "initial code size" byte
      remaining = imgW * imgH; // reset navigation variables
      curPixel = 0;
      lzwencoder.compress(initCodeSize + 1, os); // compress and write the pixel data
      os.writeByte(0); // write block terminator
    },
  };
  return lzwencoder;
};

/*
 * NeuQuant Neural-Net Quantization Algorithm
 * ------------------------------------------
 *
 * Copyright (c) 1994 Anthony Dekker
 *
 * NEUQUANT Neural-Net quantization algorithm by Anthony Dekker, 1994. See
 * "Kohonen neural networks for optimal colour quantization" in "Network:
 * Computation in Neural Systems" Vol. 5 (1994) pp 351-367. for a discussion of
 * the algorithm.
 *
 * Any party obtaining a copy of these files from the author, directly or
 * indirectly, is granted, free of charge, a full and unrestricted irrevocable,
 * world-wide, paid up, royalty-free, nonexclusive right and license to deal in
 * this software and documentation files (the "Software"), including without
 * limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons who
 * receive copies from any such party to do so, with the only requirement being
 * that this copyright notice remain intact.
 */

/*
 * This class handles Neural-Net quantization algorithm
 * @author Kevin Weiner (original Java version - kweiner@fmsware.com)
 * @author Thibault Imbert (AS3 version - bytearray.org)
 * @author Kevin Kwok (JavaScript version - https://github.com/antimatter15/jsgif)
 * @version 0.1 AS3 implementation
 */

const createNeuQuant = ({ pixels, len, sample }) => {
  var netsize = 256; /* number of colours used */

  /* four primes near 500 - assume no image has a length so large */
  /* that it is divisible by all four primes */

  var prime1 = 499;
  var prime2 = 491;
  var prime3 = 487;
  var prime4 = 503;
  var minpicturebytes = 3 * prime4; /* minimum size for input image */

  /*
   * Program Skeleton ---------------- [select samplefac in range 1..30] [read
   * image from input file] pic = (unsigned char*) malloc(3*width*height);
   * initnet(pic,3*width*height,samplefac); learn(); unbiasnet(); [write output
   * image header, using writecolourmap(f)] inxbuild(); write output image using
   * inxsearch(b,g,r)
   */

  /*
   * Network Definitions -------------------
   */

  var maxnetpos = netsize - 1;
  var netbiasshift = 4; /* bias for colour values */
  var ncycles = 100; /* no. of learning cycles */

  /* defs for freq and bias */
  var intbiasshift = 16; /* bias for fractions */
  var intbias = 1 << intbiasshift;
  var gammashift = 10; /* gamma = 1024 */
  var betashift = 10;
  var beta = intbias >> betashift; /* beta = 1/1024 */
  var betagamma = intbias << (gammashift - betashift);

  /* defs for decreasing radius factor */
  var initrad = netsize >> 3; /* for 256 cols, radius starts */
  var radiusbiasshift = 6; /* at 32.0 biased by 6 bits */
  var radiusbias = 1 << radiusbiasshift;
  var initradius = initrad * radiusbias; /* and decreases by a */
  var radiusdec = 30; /* factor of 1/30 each cycle */

  /* defs for decreasing alpha factor */
  var alphabiasshift = 10; /* alpha starts at 1.0 */
  var initalpha = 1 << alphabiasshift;
  var alphadec; /* biased by 10 bits */

  /* radbias and alpharadbias used for radpower calculation */
  var radbiasshift = 8;
  var radbias = 1 << radbiasshift;
  var alpharadbshift = alphabiasshift + radbiasshift;
  var alpharadbias = 1 << alpharadbshift;

  /*
   * Types and Global Variables --------------------------
   */

  var thepicture; /* the input image itself */
  var lengthcount; /* lengthcount = H*W*3 */
  var samplefac; /* sampling factor 1..30 */

  // typedef int pixel[4]; /* BGRc */
  var network; /* the network itself - [netsize][4] */
  var netindex = [];

  /* for network lookup - really 256 */
  var bias = [];

  /* bias and freq arrays for learning */
  var freq = [];
  var radpower = [];

  var i;
  var p;
  thepicture = pixels;
  lengthcount = len;
  samplefac = sample;
  network = new Array(netsize);

  for (i = 0; i < netsize; i++) {
    network[i] = new Array(4);
    p = network[i];
    p[0] = p[1] = p[2] = (i << (netbiasshift + 8)) / netsize;
    freq[i] = intbias / netsize; /* 1/netsize */
    bias[i] = 0;
  }

  const colorMap = () => {
    var map = [];
    var index = new Array(netsize);

    for (var i = 0; i < netsize; i++) index[network[i][3]] = i;

    var k = 0;
    for (var l = 0; l < netsize; l++) {
      var j = index[l];
      map[k++] = network[j][0];
      map[k++] = network[j][1];
      map[k++] = network[j][2];
    }

    return map;
  };

  /*
   * Insertion sort of network and building of netindex[0..255] (to do after
   * unbias)
   * -------------------------------------------------------------------------------
   */

  const inxbuild = () => {
    var i;
    var j;
    var smallpos;
    var smallval;
    var p;
    var q;
    var previouscol;
    var startpos;

    previouscol = 0;
    startpos = 0;
    for (i = 0; i < netsize; i++) {
      p = network[i];
      smallpos = i;
      smallval = p[1]; /* index on g */

      /* find smallest in i..netsize-1 */
      for (j = i + 1; j < netsize; j++) {
        q = network[j];
        if (q[1] < smallval) {
          /* index on g */
          smallpos = j;
          smallval = q[1]; /* index on g */
        }
      }
      q = network[smallpos];

      /* swap p (i) and q (smallpos) entries */
      if (i !== smallpos) {
        j = q[0];
        q[0] = p[0];
        p[0] = j;
        j = q[1];
        q[1] = p[1];
        p[1] = j;
        j = q[2];
        q[2] = p[2];
        p[2] = j;
        j = q[3];
        q[3] = p[3];
        p[3] = j;
      }

      /* smallval entry is now in position i */

      if (smallval !== previouscol) {
        netindex[previouscol] = (startpos + i) >> 1;

        for (j = previouscol + 1; j < smallval; j++) netindex[j] = i;

        previouscol = smallval;
        startpos = i;
      }
    }

    netindex[previouscol] = (startpos + maxnetpos) >> 1;
    for (j = previouscol + 1; j < 256; j++)
      netindex[j] = maxnetpos; /* really 256 */
  };

  /*
   * Main Learning Loop ------------------
   */
  const learn = () => {
    var i;
    var j;
    var b;
    var g;
    var r;
    var radius;
    var rad;
    var alpha;
    var step;
    var delta;
    var samplepixels;
    var p;
    var pix;
    var lim;

    if (lengthcount < minpicturebytes) samplefac = 1;

    alphadec = 30 + (samplefac - 1) / 3;
    p = thepicture;
    pix = 0;
    lim = lengthcount;
    samplepixels = lengthcount / (3 * samplefac);
    delta = (samplepixels / ncycles) | 0;
    alpha = initalpha;
    radius = initradius;

    rad = radius >> radiusbiasshift;
    if (rad <= 1) rad = 0;

    for (i = 0; i < rad; i++)
      radpower[i] = alpha * (((rad * rad - i * i) * radbias) / (rad * rad));

    if (lengthcount < minpicturebytes) {
      step = 3;
    } else if (lengthcount % prime1 !== 0) {
      step = 3 * prime1;
    } else if (lengthcount % prime2 === 0) {
      if (lengthcount % prime3 === 0) {
        step = 3 * prime4;
      } else {
        step = 3 * prime3;
      }
    } else {
      step = 3 * prime2;
    }

    i = 0;
    while (i < samplepixels) {
      b = (p[pix + 0] & 0xff) << netbiasshift;
      g = (p[pix + 1] & 0xff) << netbiasshift;
      r = (p[pix + 2] & 0xff) << netbiasshift;
      j = contest(b, g, r);

      altersingle(alpha, j, b, g, r);
      if (rad !== 0) alterneigh(rad, j, b, g, r); /* alter neighbours */

      pix += step;
      if (pix >= lim) pix -= lengthcount;

      i++;

      if (delta === 0) delta = 1;

      if (i % delta === 0) {
        alpha -= alpha / alphadec;
        radius -= radius / radiusdec;
        rad = radius >> radiusbiasshift;

        if (rad <= 1) rad = 0;

        for (j = 0; j < rad; j++)
          radpower[j] = alpha * (((rad * rad - j * j) * radbias) / (rad * rad));
      }
    }
  };

  /*
   * Unbias network to give byte values 0..255 and record position i to prepare
   * for sort
   * -----------------------------------------------------------------------------------
   */
  const unbiasnet = () => {
    let i = 0;
    while (i < netsize) {
      network[i][0] >>= netbiasshift;
      network[i][1] >>= netbiasshift;
      network[i][2] >>= netbiasshift;
      network[i][3] = i; /* record colour no */
      i++;
    }
  };

  /*
   * Move adjacent neurons by precomputed alpha*(1-((i-j)^2/[r]^2)) in
   * radpower[|i-j|]
   * ---------------------------------------------------------------------------------
   */
  const alterneigh = (rad, i, b, g, r) => {
    var j;
    var k;
    var lo;
    var hi;
    var a;
    var m;
    var p;

    lo = i - rad;
    if (lo < -1) lo = -1;

    hi = i + rad;
    if (hi > netsize) hi = netsize;

    j = i + 1;
    k = i - 1;
    m = 1;

    while (j < hi || k > lo) {
      a = radpower[m++];

      if (j < hi) {
        p = network[j++];

        try {
          p[0] -= (a * (p[0] - b)) / alpharadbias;
          p[1] -= (a * (p[1] - g)) / alpharadbias;
          p[2] -= (a * (p[2] - r)) / alpharadbias;
        } catch (e) {} // prevents 1.3 miscompilation
      }

      if (k > lo) {
        p = network[k--];

        try {
          p[0] -= (a * (p[0] - b)) / alpharadbias;
          p[1] -= (a * (p[1] - g)) / alpharadbias;
          p[2] -= (a * (p[2] - r)) / alpharadbias;
        } catch (e) {}
      }
    }
  };

  /*
   * Move neuron i towards biased (b,g,r) by factor alpha
   * ----------------------------------------------------
   */
  const altersingle = (alpha, i, b, g, r) => {
    /* alter hit neuron */
    var n = network[i];
    n[0] -= (alpha * (n[0] - b)) / initalpha;
    n[1] -= (alpha * (n[1] - g)) / initalpha;
    n[2] -= (alpha * (n[2] - r)) / initalpha;
  };

  /*
   * Search for biased BGR values ----------------------------
   */
  const contest = (b, g, r) => {
    /* finds closest neuron (min dist) and updates freq */
    /* finds best neuron (min dist-bias) and returns position */
    /* for frequently chosen neurons, freq[i] is high and bias[i] is negative */
    /* bias[i] = gamma*((1/netsize)-freq[i]) */

    var i;
    var dist;
    var a;
    var biasdist;
    var betafreq;
    var bestpos;
    var bestbiaspos;
    var bestd;
    var bestbiasd;
    var n;

    bestd = 2147483647;
    bestbiasd = bestd;
    bestpos = -1;
    bestbiaspos = bestpos;

    for (i = 0; i < netsize; i++) {
      n = network[i];
      dist = n[0] - b;
      if (dist < 0) dist = -dist;
      a = n[1] - g;
      if (a < 0) a = -a;
      dist += a;
      a = n[2] - r;
      if (a < 0) a = -a;
      dist += a;

      if (dist < bestd) {
        bestd = dist;
        bestpos = i;
      }

      biasdist = dist - (bias[i] >> (intbiasshift - netbiasshift));

      if (biasdist < bestbiasd) {
        bestbiasd = biasdist;
        bestbiaspos = i;
      }

      betafreq = freq[i] >> betashift;
      freq[i] -= betafreq;
      bias[i] += betafreq << gammashift;
    }

    freq[bestpos] += beta;
    bias[bestpos] -= betagamma;
    return bestbiaspos;
  };

  const neuquant = {
    /*
     ** Search for BGR values 0..255 (after net is unbiased) and return colour
     * index
     * ----------------------------------------------------------------------------
     */
    map: (b, g, r) => {
      var i;
      var j;
      var dist;
      var a;
      var bestd;
      var p;
      var best;

      bestd = 1000; /* biggest possible dist is 256*3 */
      best = -1;
      i = netindex[g]; /* index on g */
      j = i - 1; /* start at netindex[g] and work outwards */

      while (i < netsize || j >= 0) {
        if (i < netsize) {
          p = network[i];
          dist = p[1] - g; /* inx key */

          if (dist >= bestd) i = netsize; /* stop iter */
          else {
            i++;
            if (dist < 0) dist = -dist;
            a = p[0] - b;
            if (a < 0) a = -a;
            dist += a;

            if (dist < bestd) {
              a = p[2] - r;
              if (a < 0) a = -a;
              dist += a;

              if (dist < bestd) {
                bestd = dist;
                best = p[3];
              }
            }
          }
        }

        if (j >= 0) {
          p = network[j];
          dist = g - p[1]; /* inx key - reverse dif */

          if (dist >= bestd) j = -1; /* stop iter */
          else {
            j--;
            if (dist < 0) dist = -dist;
            a = p[0] - b;
            if (a < 0) a = -a;
            dist += a;

            if (dist < bestd) {
              a = p[2] - r;
              if (a < 0) a = -a;
              dist += a;
              if (dist < bestd) {
                bestd = dist;
                best = p[3];
              }
            }
          }
        }
      }

      return best;
    },
    process: () => {
      learn();
      unbiasnet();
      inxbuild();
      return colorMap();
    },
  };
  return neuquant;
};

// https://github.com/incubated-geek-cc/video-to-GIF/blob/main/js/GIFEncoder.js
// https://github.com/jnordberg/gif.js
// https://github.com/jnordberg/gif.js/blob/master/src/GIFEncoder.js


const createGifEncoder = ({
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
      } catch {
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
      } catch {
        return false;
      }
    },

    readAsBinaryString,
    toDataUrl: () => {
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


const { Terminal } = window;
const { FitAddon } = window.FitAddon;
const { WebglAddon } = window.WebglAddon;
const { SerializeAddon } = window.SerializeAddon;

const initTerminal = ({
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

  const cssUrl = new URL("/css/xterm.css", import.meta.url);
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
      {
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
  {
    context.roundRect(x, y, width, height, [radius]);
  }
  {
    context.fillStyle = fill;
    context.fill();
  }
  {
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

export { initTerminal };
