// Pure zero-dependency ISO/IEC 18004 QR Code SVG Generator (Byte Mode, ECC Level L, Versions 1-10)
(function (global) {
  "use strict";

  // Total codewords & ECC codewords per block for ECC Level L (Versions 1..10)
  // [version, size, totalCodewords, ecPerBlock, numBlocks, alignCenters]
  const VERSIONS = [
    null,
    { v: 1, size: 21, dataCw: 19, ecCw: 7, blocks: [19], align: [] },
    { v: 2, size: 25, dataCw: 34, ecCw: 10, blocks: [34], align: [6, 18] },
    { v: 3, size: 29, dataCw: 55, ecCw: 15, blocks: [55], align: [6, 22] },
    { v: 4, size: 33, dataCw: 80, ecCw: 20, blocks: [80], align: [6, 26] },
    { v: 5, size: 37, dataCw: 108, ecCw: 26, blocks: [108], align: [6, 30] },
    { v: 6, size: 41, dataCw: 136, ecCw: 18, blocks: [68, 68], align: [6, 34] },
    { v: 7, size: 45, dataCw: 156, ecCw: 20, blocks: [78, 78], align: [6, 22, 38] },
    { v: 8, size: 49, dataCw: 194, ecCw: 24, blocks: [97, 97], align: [6, 24, 42] },
    { v: 9, size: 53, dataCw: 232, ecCw: 30, blocks: [116, 116], align: [6, 26, 46] },
    { v: 10, size: 57, dataCw: 274, ecCw: 18, blocks: [68, 68, 69, 69], align: [6, 28, 50] }
  ];

  // GF(256) tables (primitive poly 0x11d)
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, ecLen) {
    const gen = rsGeneratorPoly(ecLen);
    const res = new Uint8Array(ecLen);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ res[0];
      for (let j = 0; j < ecLen - 1; j++) res[j] = res[j + 1];
      res[ecLen - 1] = 0;
      if (factor !== 0) {
        for (let j = 0; j < ecLen; j++) res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return res;
  }

  function toUtf8Bytes(str) {
    if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(str));
    const utf8 = unescape(encodeURIComponent(str));
    const arr = [];
    for (let i = 0; i < utf8.length; i++) arr.push(utf8.charCodeAt(i));
    return arr;
  }

  function encodeData(bytes, ver) {
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    const countBits = ver.v >= 10 ? 16 : 8;
    pushBits(0b0100, 4); // Byte mode
    pushBits(bytes.length, countBits);
    bytes.forEach((b) => pushBits(b, 8));

    const maxBits = ver.dataCw * 8;
    const termLen = Math.min(4, maxBits - bits.length);
    for (let i = 0; i < termLen; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codewords.push(b);
    }
    const pads = [0xec, 0x11];
    let p = 0;
    while (codewords.length < ver.dataCw) {
      codewords.push(pads[p++ % 2]);
    }
    return codewords;
  }

  function interleaveBlocks(dataCw, ver) {
    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;
    for (const len of ver.blocks) {
      const slice = dataCw.slice(offset, offset + len);
      offset += len;
      dataBlocks.push(slice);
      ecBlocks.push(rsRemainder(slice, ver.ecCw));
    }
    const out = [];
    const maxDataLen = Math.max(...ver.blocks);
    for (let i = 0; i < maxDataLen; i++) {
      for (const blk of dataBlocks) {
        if (i < blk.length) out.push(blk[i]);
      }
    }
    for (let i = 0; i < ver.ecCw; i++) {
      for (const ec of ecBlocks) out.push(ec[i]);
    }
    return out;
  }

  function formatBits(mask) {
    // ECC L = 01
    const data = (0b01 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }

  function versionBits(v) {
    let rem = v;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (v << 12) | rem;
  }

  function buildMatrix(ver, codewords) {
    const n = ver.size;
    const mat = Array.from({ length: n }, () => new Int8Array(n)); // 0 empty, 1 dark, -1 light
    const isFunc = Array.from({ length: n }, () => new Uint8Array(n));

    const setFunc = (r, c, dark) => {
      if (r < 0 || r >= n || c < 0 || c >= n) return;
      mat[r][c] = dark ? 1 : -1;
      isFunc[r][c] = 1;
    };

    const drawFinder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = r0 + dr;
          const c = c0 + dc;
          if (r < 0 || r >= n || c < 0 || c >= n) continue;
          const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
          setFunc(r, c, dist !== 2 && dist !== 4);
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, n - 7);
    drawFinder(n - 7, 0);

    // Alignment patterns
    for (const r of ver.align) {
      for (const c of ver.align) {
        if (isFunc[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            setFunc(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < n - 8; i++) {
      if (!isFunc[6][i]) setFunc(6, i, i % 2 === 0);
      if (!isFunc[i][6]) setFunc(i, 6, i % 2 === 0);
    }

    // Reserve format areas + dark module
    for (let i = 0; i <= 8; i++) {
      if (!isFunc[8][i]) setFunc(8, i, false);
      if (!isFunc[i][8]) setFunc(i, 8, false);
    }
    for (let i = n - 8; i < n; i++) {
      if (!isFunc[8][i]) setFunc(8, i, false);
      if (!isFunc[i][8]) setFunc(i, 8, false);
    }
    setFunc(n - 8, 8, true);

    // Version info for v >= 7
    if (ver.v >= 7) {
      const vb = versionBits(ver.v);
      for (let i = 0; i < 18; i++) {
        const dark = ((vb >>> i) & 1) === 1;
        const a = Math.floor(i / 3);
        const b = n - 11 + (i % 3);
        setFunc(a, b, dark);
        setFunc(b, a, dark);
      }
    }

    // Place data bits
    const allBits = [];
    for (const cw of codewords) {
      for (let i = 7; i >= 0; i--) allBits.push((cw >>> i) & 1);
    }
    let bitIdx = 0;
    let upward = true;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        const r = upward ? n - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          if (!isFunc[r][c]) {
            const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
            mat[r][c] = bit ? 1 : -1;
          }
        }
      }
      upward = !upward;
    }

    // Apply Mask 0 ((r + c) % 2 === 0) and write format info
    const mask = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!isFunc[r][c] && (r + c) % 2 === 0) {
          mat[r][c] = -mat[r][c];
        }
      }
    }

    const fb = formatBits(mask);
    for (let i = 0; i <= 5; i++) setFunc(8, i, ((fb >>> (14 - i)) & 1) === 1);
    setFunc(8, 7, ((fb >>> 8) & 1) === 1);
    setFunc(8, 8, ((fb >>> 7) & 1) === 1);
    setFunc(7, 8, ((fb >>> 6) & 1) === 1);
    for (let i = 9; i < 15; i++) setFunc(14 - i, 8, ((fb >>> (14 - i)) & 1) === 1);

    for (let i = 0; i < 8; i++) setFunc(8, n - 1 - i, ((fb >>> i) & 1) === 1);
    for (let i = 8; i < 15; i++) setFunc(n - 15 + i, 8, ((fb >>> i) & 1) === 1);

    return mat;
  }

  function generateQrSvg(text, pxSize) {
    const bytes = toUtf8Bytes(text);
    let ver = null;
    for (let v = 1; v < VERSIONS.length; v++) {
      const cap = VERSIONS[v].dataCw - (v >= 10 ? 3 : 2);
      if (bytes.length <= cap) {
        ver = VERSIONS[v];
        break;
      }
    }
    if (!ver) ver = VERSIONS[VERSIONS.length - 1];
    const dataCw = encodeData(bytes.slice(0, ver.dataCw - 3), ver);
    const fullCw = interleaveBlocks(dataCw, ver);
    const mat = buildMatrix(ver, fullCw);
    const n = ver.size;
    const quiet = 4;
    const view = n + quiet * 2;
    const size = pxSize || 220;

    let pathD = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (mat[r][c] === 1) {
          pathD += `M${c + quiet},${r + quiet}h1v1h-1z`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}" shape-rendering="crispEdges" role="img" aria-label="QR Code">
      <rect width="${view}" height="${view}" fill="#ffffff"/>
      <path d="${pathD}" fill="#0f172a"/>
    </svg>`;
  }

  global.EduQr = { generateQrSvg };
})(window);
