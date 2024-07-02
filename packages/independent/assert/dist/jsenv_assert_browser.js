function ansiRegex({
  onlyFirst = false
} = {}) {
  const pattern = ['[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)', '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'].join('|');
  return new RegExp(pattern, onlyFirst ? undefined : 'g');
}

const regex = ansiRegex();
function stripAnsi(string) {
  if (typeof string !== 'string') {
    throw new TypeError("Expected a `string`, got `".concat(typeof string, "`"));
  }

  // Even though the regex is global, we don't need to reset the `.lastIndex`
  // because unlike `.exec()` and `.test()`, `.replace()` does it automatically
  // and doing it manually has a performance penalty.
  return string.replace(regex, '');
}

// Generated code.

function isAmbiguous(x) {
  return x === 0xA1 || x === 0xA4 || x === 0xA7 || x === 0xA8 || x === 0xAA || x === 0xAD || x === 0xAE || x >= 0xB0 && x <= 0xB4 || x >= 0xB6 && x <= 0xBA || x >= 0xBC && x <= 0xBF || x === 0xC6 || x === 0xD0 || x === 0xD7 || x === 0xD8 || x >= 0xDE && x <= 0xE1 || x === 0xE6 || x >= 0xE8 && x <= 0xEA || x === 0xEC || x === 0xED || x === 0xF0 || x === 0xF2 || x === 0xF3 || x >= 0xF7 && x <= 0xFA || x === 0xFC || x === 0xFE || x === 0x101 || x === 0x111 || x === 0x113 || x === 0x11B || x === 0x126 || x === 0x127 || x === 0x12B || x >= 0x131 && x <= 0x133 || x === 0x138 || x >= 0x13F && x <= 0x142 || x === 0x144 || x >= 0x148 && x <= 0x14B || x === 0x14D || x === 0x152 || x === 0x153 || x === 0x166 || x === 0x167 || x === 0x16B || x === 0x1CE || x === 0x1D0 || x === 0x1D2 || x === 0x1D4 || x === 0x1D6 || x === 0x1D8 || x === 0x1DA || x === 0x1DC || x === 0x251 || x === 0x261 || x === 0x2C4 || x === 0x2C7 || x >= 0x2C9 && x <= 0x2CB || x === 0x2CD || x === 0x2D0 || x >= 0x2D8 && x <= 0x2DB || x === 0x2DD || x === 0x2DF || x >= 0x300 && x <= 0x36F || x >= 0x391 && x <= 0x3A1 || x >= 0x3A3 && x <= 0x3A9 || x >= 0x3B1 && x <= 0x3C1 || x >= 0x3C3 && x <= 0x3C9 || x === 0x401 || x >= 0x410 && x <= 0x44F || x === 0x451 || x === 0x2010 || x >= 0x2013 && x <= 0x2016 || x === 0x2018 || x === 0x2019 || x === 0x201C || x === 0x201D || x >= 0x2020 && x <= 0x2022 || x >= 0x2024 && x <= 0x2027 || x === 0x2030 || x === 0x2032 || x === 0x2033 || x === 0x2035 || x === 0x203B || x === 0x203E || x === 0x2074 || x === 0x207F || x >= 0x2081 && x <= 0x2084 || x === 0x20AC || x === 0x2103 || x === 0x2105 || x === 0x2109 || x === 0x2113 || x === 0x2116 || x === 0x2121 || x === 0x2122 || x === 0x2126 || x === 0x212B || x === 0x2153 || x === 0x2154 || x >= 0x215B && x <= 0x215E || x >= 0x2160 && x <= 0x216B || x >= 0x2170 && x <= 0x2179 || x === 0x2189 || x >= 0x2190 && x <= 0x2199 || x === 0x21B8 || x === 0x21B9 || x === 0x21D2 || x === 0x21D4 || x === 0x21E7 || x === 0x2200 || x === 0x2202 || x === 0x2203 || x === 0x2207 || x === 0x2208 || x === 0x220B || x === 0x220F || x === 0x2211 || x === 0x2215 || x === 0x221A || x >= 0x221D && x <= 0x2220 || x === 0x2223 || x === 0x2225 || x >= 0x2227 && x <= 0x222C || x === 0x222E || x >= 0x2234 && x <= 0x2237 || x === 0x223C || x === 0x223D || x === 0x2248 || x === 0x224C || x === 0x2252 || x === 0x2260 || x === 0x2261 || x >= 0x2264 && x <= 0x2267 || x === 0x226A || x === 0x226B || x === 0x226E || x === 0x226F || x === 0x2282 || x === 0x2283 || x === 0x2286 || x === 0x2287 || x === 0x2295 || x === 0x2299 || x === 0x22A5 || x === 0x22BF || x === 0x2312 || x >= 0x2460 && x <= 0x24E9 || x >= 0x24EB && x <= 0x254B || x >= 0x2550 && x <= 0x2573 || x >= 0x2580 && x <= 0x258F || x >= 0x2592 && x <= 0x2595 || x === 0x25A0 || x === 0x25A1 || x >= 0x25A3 && x <= 0x25A9 || x === 0x25B2 || x === 0x25B3 || x === 0x25B6 || x === 0x25B7 || x === 0x25BC || x === 0x25BD || x === 0x25C0 || x === 0x25C1 || x >= 0x25C6 && x <= 0x25C8 || x === 0x25CB || x >= 0x25CE && x <= 0x25D1 || x >= 0x25E2 && x <= 0x25E5 || x === 0x25EF || x === 0x2605 || x === 0x2606 || x === 0x2609 || x === 0x260E || x === 0x260F || x === 0x261C || x === 0x261E || x === 0x2640 || x === 0x2642 || x === 0x2660 || x === 0x2661 || x >= 0x2663 && x <= 0x2665 || x >= 0x2667 && x <= 0x266A || x === 0x266C || x === 0x266D || x === 0x266F || x === 0x269E || x === 0x269F || x === 0x26BF || x >= 0x26C6 && x <= 0x26CD || x >= 0x26CF && x <= 0x26D3 || x >= 0x26D5 && x <= 0x26E1 || x === 0x26E3 || x === 0x26E8 || x === 0x26E9 || x >= 0x26EB && x <= 0x26F1 || x === 0x26F4 || x >= 0x26F6 && x <= 0x26F9 || x === 0x26FB || x === 0x26FC || x === 0x26FE || x === 0x26FF || x === 0x273D || x >= 0x2776 && x <= 0x277F || x >= 0x2B56 && x <= 0x2B59 || x >= 0x3248 && x <= 0x324F || x >= 0xE000 && x <= 0xF8FF || x >= 0xFE00 && x <= 0xFE0F || x === 0xFFFD || x >= 0x1F100 && x <= 0x1F10A || x >= 0x1F110 && x <= 0x1F12D || x >= 0x1F130 && x <= 0x1F169 || x >= 0x1F170 && x <= 0x1F18D || x === 0x1F18F || x === 0x1F190 || x >= 0x1F19B && x <= 0x1F1AC || x >= 0xE0100 && x <= 0xE01EF || x >= 0xF0000 && x <= 0xFFFFD || x >= 0x100000 && x <= 0x10FFFD;
}
function isFullWidth(x) {
  return x === 0x3000 || x >= 0xFF01 && x <= 0xFF60 || x >= 0xFFE0 && x <= 0xFFE6;
}
function isWide(x) {
  return x >= 0x1100 && x <= 0x115F || x === 0x231A || x === 0x231B || x === 0x2329 || x === 0x232A || x >= 0x23E9 && x <= 0x23EC || x === 0x23F0 || x === 0x23F3 || x === 0x25FD || x === 0x25FE || x === 0x2614 || x === 0x2615 || x >= 0x2648 && x <= 0x2653 || x === 0x267F || x === 0x2693 || x === 0x26A1 || x === 0x26AA || x === 0x26AB || x === 0x26BD || x === 0x26BE || x === 0x26C4 || x === 0x26C5 || x === 0x26CE || x === 0x26D4 || x === 0x26EA || x === 0x26F2 || x === 0x26F3 || x === 0x26F5 || x === 0x26FA || x === 0x26FD || x === 0x2705 || x === 0x270A || x === 0x270B || x === 0x2728 || x === 0x274C || x === 0x274E || x >= 0x2753 && x <= 0x2755 || x === 0x2757 || x >= 0x2795 && x <= 0x2797 || x === 0x27B0 || x === 0x27BF || x === 0x2B1B || x === 0x2B1C || x === 0x2B50 || x === 0x2B55 || x >= 0x2E80 && x <= 0x2E99 || x >= 0x2E9B && x <= 0x2EF3 || x >= 0x2F00 && x <= 0x2FD5 || x >= 0x2FF0 && x <= 0x2FFF || x >= 0x3001 && x <= 0x303E || x >= 0x3041 && x <= 0x3096 || x >= 0x3099 && x <= 0x30FF || x >= 0x3105 && x <= 0x312F || x >= 0x3131 && x <= 0x318E || x >= 0x3190 && x <= 0x31E3 || x >= 0x31EF && x <= 0x321E || x >= 0x3220 && x <= 0x3247 || x >= 0x3250 && x <= 0x4DBF || x >= 0x4E00 && x <= 0xA48C || x >= 0xA490 && x <= 0xA4C6 || x >= 0xA960 && x <= 0xA97C || x >= 0xAC00 && x <= 0xD7A3 || x >= 0xF900 && x <= 0xFAFF || x >= 0xFE10 && x <= 0xFE19 || x >= 0xFE30 && x <= 0xFE52 || x >= 0xFE54 && x <= 0xFE66 || x >= 0xFE68 && x <= 0xFE6B || x >= 0x16FE0 && x <= 0x16FE4 || x === 0x16FF0 || x === 0x16FF1 || x >= 0x17000 && x <= 0x187F7 || x >= 0x18800 && x <= 0x18CD5 || x >= 0x18D00 && x <= 0x18D08 || x >= 0x1AFF0 && x <= 0x1AFF3 || x >= 0x1AFF5 && x <= 0x1AFFB || x === 0x1AFFD || x === 0x1AFFE || x >= 0x1B000 && x <= 0x1B122 || x === 0x1B132 || x >= 0x1B150 && x <= 0x1B152 || x === 0x1B155 || x >= 0x1B164 && x <= 0x1B167 || x >= 0x1B170 && x <= 0x1B2FB || x === 0x1F004 || x === 0x1F0CF || x === 0x1F18E || x >= 0x1F191 && x <= 0x1F19A || x >= 0x1F200 && x <= 0x1F202 || x >= 0x1F210 && x <= 0x1F23B || x >= 0x1F240 && x <= 0x1F248 || x === 0x1F250 || x === 0x1F251 || x >= 0x1F260 && x <= 0x1F265 || x >= 0x1F300 && x <= 0x1F320 || x >= 0x1F32D && x <= 0x1F335 || x >= 0x1F337 && x <= 0x1F37C || x >= 0x1F37E && x <= 0x1F393 || x >= 0x1F3A0 && x <= 0x1F3CA || x >= 0x1F3CF && x <= 0x1F3D3 || x >= 0x1F3E0 && x <= 0x1F3F0 || x === 0x1F3F4 || x >= 0x1F3F8 && x <= 0x1F43E || x === 0x1F440 || x >= 0x1F442 && x <= 0x1F4FC || x >= 0x1F4FF && x <= 0x1F53D || x >= 0x1F54B && x <= 0x1F54E || x >= 0x1F550 && x <= 0x1F567 || x === 0x1F57A || x === 0x1F595 || x === 0x1F596 || x === 0x1F5A4 || x >= 0x1F5FB && x <= 0x1F64F || x >= 0x1F680 && x <= 0x1F6C5 || x === 0x1F6CC || x >= 0x1F6D0 && x <= 0x1F6D2 || x >= 0x1F6D5 && x <= 0x1F6D7 || x >= 0x1F6DC && x <= 0x1F6DF || x === 0x1F6EB || x === 0x1F6EC || x >= 0x1F6F4 && x <= 0x1F6FC || x >= 0x1F7E0 && x <= 0x1F7EB || x === 0x1F7F0 || x >= 0x1F90C && x <= 0x1F93A || x >= 0x1F93C && x <= 0x1F945 || x >= 0x1F947 && x <= 0x1F9FF || x >= 0x1FA70 && x <= 0x1FA7C || x >= 0x1FA80 && x <= 0x1FA88 || x >= 0x1FA90 && x <= 0x1FABD || x >= 0x1FABF && x <= 0x1FAC5 || x >= 0x1FACE && x <= 0x1FADB || x >= 0x1FAE0 && x <= 0x1FAE8 || x >= 0x1FAF0 && x <= 0x1FAF8 || x >= 0x20000 && x <= 0x2FFFD || x >= 0x30000 && x <= 0x3FFFD;
}

function validate(codePoint) {
  if (!Number.isSafeInteger(codePoint)) {
    throw new TypeError("Expected a code point, got `".concat(typeof codePoint, "`."));
  }
}
function eastAsianWidth(codePoint, {
  ambiguousAsWide = false
} = {}) {
  validate(codePoint);
  if (isFullWidth(codePoint) || isWide(codePoint) || ambiguousAsWide && isAmbiguous(codePoint)) {
    return 2;
  }
  return 1;
}

const emojiRegex = (() => {
  // https://mths.be/emoji
  return /[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26D3\uFE0F?(?:\u200D\uD83D\uDCA5)?|\u26F9(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF43\uDF45-\uDF4A\uDF4C-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDF44(?:\u200D\uD83D\uDFEB)?|\uDF4B(?:\u200D\uD83D\uDFE9)?|\uDFC3(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4\uDEB5](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE41\uDE43\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC08(?:\u200D\u2B1B)?|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC26(?:\u200D(?:\u2B1B|\uD83D\uDD25))?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE])))?))?|\uDC6F(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDD75(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?|\uDE42(?:\u200D[\u2194\u2195]\uFE0F?)?|\uDEB6(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC2\uDECE-\uDEDB\uDEE0-\uDEE8]|\uDD3C(?:\u200D[\u2640\u2642]\uFE0F?|\uD83C[\uDFFB-\uDFFF])?|\uDDCE(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1|\uDDD1\u200D\uD83E\uDDD2(?:\u200D\uD83E\uDDD2)?|\uDDD2(?:\u200D\uD83E\uDDD2)?))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?)/g;
});

function stringWidth(string, options = {}) {
  if (typeof string !== 'string' || string.length === 0) {
    return 0;
  }
  const {
    ambiguousIsNarrow = true,
    countAnsiEscapeCodes = false
  } = options;
  if (!countAnsiEscapeCodes) {
    string = stripAnsi(string);
  }
  if (string.length === 0) {
    return 0;
  }
  let width = 0;
  for (const {
    segment: character
  } of new Intl.Segmenter().segment(string)) {
    const codePoint = character.codePointAt(0);

    // Ignore control characters
    if (codePoint <= 0x1F || codePoint >= 0x7F && codePoint <= 0x9F) {
      continue;
    }

    // Ignore combining characters
    if (codePoint >= 0x300 && codePoint <= 0x36F) {
      continue;
    }
    if (emojiRegex().test(character)) {
      width += 2;
      continue;
    }
    width += eastAsianWidth(codePoint, {
      ambiguousAsWide: !ambiguousIsNarrow
    });
  }
  return width;
}

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";
const ANSI = {
  supported: true,
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  GREY: "\x1b[90m",
  color: (text, ANSI_COLOR) => {
    return ANSI_COLOR ? "".concat(ANSI_COLOR).concat(text).concat(RESET) : text;
  },
  BOLD: "\x1b[1m",
  UNDERLINE: "\x1b[4m",
  STRIKE: "\x1b[9m",
  effect: (text, ANSI_EFFECT) => {
    return ANSI_EFFECT ? "".concat(ANSI_EFFECT).concat(text).concat(RESET) : text;
  }
};

// see also https://github.com/sindresorhus/figures

const UNICODE = {
  supported: true,
  get COMMAND_RAW() {
    return "\u276F" ;
  },
  get OK_RAW() {
    return "\u2714" ;
  },
  get FAILURE_RAW() {
    return "\u2716" ;
  },
  get DEBUG_RAW() {
    return "\u25C6" ;
  },
  get INFO_RAW() {
    return "\u2139" ;
  },
  get WARNING_RAW() {
    return "\u26A0" ;
  },
  get CIRCLE_CROSS_RAW() {
    return "\u24E7" ;
  },
  get COMMAND() {
    return ANSI.color(UNICODE.COMMAND_RAW, ANSI.GREY); // ANSI_MAGENTA)
  },
  get OK() {
    return ANSI.color(UNICODE.OK_RAW, ANSI.GREEN);
  },
  get FAILURE() {
    return ANSI.color(UNICODE.FAILURE_RAW, ANSI.RED);
  },
  get DEBUG() {
    return ANSI.color(UNICODE.DEBUG_RAW, ANSI.GREY);
  },
  get INFO() {
    return ANSI.color(UNICODE.INFO_RAW, ANSI.BLUE);
  },
  get WARNING() {
    return ANSI.color(UNICODE.WARNING_RAW, ANSI.YELLOW);
  },
  get CIRCLE_CROSS() {
    return ANSI.color(UNICODE.CIRCLE_CROSS_RAW, ANSI.RED);
  },
  get ELLIPSIS() {
    return "\u2026" ;
  }
};

const isComposite = value => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};

const isValidPropertyIdentifier = propertyName => {
  return typeof propertyName === "number" || !isNaN(propertyName) || isDotNotationAllowed(propertyName);
};
const isDotNotationAllowed = propertyName => {
  return /^[a-z_$]+[0-9a-z_&]$/i.test(propertyName) || /^[a-z_$]$/i.test(propertyName);
};

const createValuePath = (parts = []) => {
  return {
    parts,
    [Symbol.iterator]() {
      return parts[Symbol.iterator]();
    },
    toString: () => parts.map(part => part.value).join(""),
    valueOf: () => parts.map(part => part.value).join(""),
    pop: () => {
      return createValuePath(parts.slice(1));
    },
    append: (property, {
      isIndexedEntry,
      isPropertyDescriptor,
      isMeta
    } = {}) => {
      let propertyKey = "";
      let propertyKeyCanUseDot = false;
      if (isIndexedEntry) {
        propertyKey = "[".concat(property, "]");
      } else if (typeof property === "symbol") {
        propertyKey = humanizeSymbol(property);
      } else if (typeof property === "string") {
        if (
        // first "property" is a "global" variable name that does not need to be wrapped
        // in quotes
        parts.length === 0 || isDotNotationAllowed(property)) {
          propertyKey = property;
          propertyKeyCanUseDot = true;
        } else {
          propertyKey = "\"".concat(property, "\""); // TODO: property escaping
        }
      } else {
        propertyKey = String(property);
        propertyKeyCanUseDot = true;
      }
      if (parts.length === 0) {
        return createValuePath([{
          type: "identifier",
          value: propertyKey
        }]);
      }
      if (isPropertyDescriptor || isMeta) {
        return createValuePath([...parts, {
          type: "property_open_delimiter",
          value: "[["
        }, {
          type: "property_identifier",
          value: propertyKey
        }, {
          type: "property_close_delimiter",
          value: "]]"
        }]);
      }
      if (propertyKeyCanUseDot) {
        return createValuePath([...parts, {
          type: "property_dot",
          value: "."
        }, {
          type: "property_identifier",
          value: propertyKey
        }]);
      }
      return createValuePath([...parts, {
        type: "property_open_delimiter",
        value: "["
      }, {
        type: "property_identifier",
        value: propertyKey
      }, {
        type: "property_close_delimiter",
        value: "]"
      }]);
    }
  };
};
const humanizeSymbol = symbol => {
  const description = symbolToDescription$1(symbol);
  if (description) {
    const key = Symbol.keyFor(symbol);
    if (key) {
      return "Symbol.for(".concat(description, ")");
    }
    return "Symbol(".concat(description, ")");
  }
  return "Symbol()";
};
const symbolToDescription$1 = symbol => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  return toStringResult.slice(openingParenthesisIndex + 1, closingParenthesisIndex);
  // return symbol.description // does not work on node
};

const getObjectTag = obj => {
  // https://github.com/nodejs/node/blob/384fd1787634c13b3e5d2f225076d2175dc3b96b/lib/internal/util/inspect.js#L859
  while (obj || isUndetectableObject(obj)) {
    const constructorDescriptor = Object.getOwnPropertyDescriptor(obj, "constructor");
    if (constructorDescriptor !== undefined && typeof constructorDescriptor.value === "function" && constructorDescriptor.value.name !== "") {
      return String(constructorDescriptor.value.name);
    }
    const toStringTagDescriptor = Object.getOwnPropertyDescriptor(obj, Symbol.toStringTag);
    if (toStringTagDescriptor && typeof toStringTagDescriptor.value === "string") {
      return toStringTagDescriptor.value;
    }
    obj = Object.getPrototypeOf(obj);
    if (obj === null) {
      return "Object";
    }
  }
  return "";
};
function* objectPrototypeChainGenerator(obj) {
  while (obj || isUndetectableObject(obj)) {
    const proto = Object.getPrototypeOf(obj);
    if (!proto) {
      break;
    }
    yield proto;
    obj = proto;
  }
}
const isUndetectableObject = v => typeof v === "undefined" && v !== undefined;

const tokenizeFunction = fn => {
  const fnSource = String(fn);
  {
    if (fnSource.startsWith("(")) {
      return {
        ...defaultFunctionAnalysis,
        type: "arrow",
        argsAndBodySource: fnSource.slice(fnSource.indexOf("("))
      };
    }
    const arrowAsyncMatch = fnSource.match(/^async\s+\(/);
    if (arrowAsyncMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "arrow",
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true
      };
    }
  }
  {
    if (fnSource.startsWith("class ")) {
      let extendedClassName = "";
      const prototype = Object.getPrototypeOf(fn);
      if (prototype && prototype !== Function.prototype) {
        extendedClassName = prototype.name;
      }
      return {
        ...defaultFunctionAnalysis,
        type: "class",
        name: fn.name,
        extendedClassName,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("{"))
      };
    }
  }
  {
    const classicAsyncGeneratorMatch = fnSource.match(/^async\s+function\s*\*/);
    if (classicAsyncGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true,
        isGenerator: true
      };
    }
    const classicAsyncMatch = fnSource.match(/^async\s+function/);
    if (classicAsyncMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true
      };
    }
    const classicGeneratorMatch = fnSource.match(/^function\s*\*/);
    if (classicGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isGenerator: true
      };
    }
    if (fnSource.startsWith("function")) {
      return {
        ...defaultFunctionAnalysis,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("("))
      };
    }
  }
  {
    if (fnSource.startsWith("get ")) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        getterName: fn.name.slice("get ".length),
        argsAndBodySource: fnSource.slice(fnSource.indexOf("("))
      };
    }
    if (fnSource.startsWith("set ")) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        setterName: fn.name.slice("set ".length),
        argsAndBodySource: fnSource.slice(fnSource.indexOf("("))
      };
    }
    const methodComputedAsyncGeneratorMatch = fnSource.match(/^async\s+\*\s*\[([\s\S]*?)\]\s*\(/);
    if (methodComputedAsyncGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedAsyncGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(methodComputedAsyncGeneratorMatch[0].length - 1),
        isAsync: true,
        isGenerator: true
      };
    }
    const methodComputedAsyncMatch = fnSource.match(/^async\s+\[([\s\S]*?)\]\s*\(/);
    if (methodComputedAsyncMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedAsyncMatch[1],
        argsAndBodySource: fnSource.slice(methodComputedAsyncMatch[0].length - 1),
        isAsync: true
      };
    }
    const methodComputedMatch = fnSource.match(/^\[([\s\S]*?)\]\s*\(/);
    if (methodComputedMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedMatch[1],
        argsAndBodySource: fnSource.slice(methodComputedMatch[0].length - 1)
      };
    }
    const methodAsyncGeneratorMatch = fnSource.match(/^async\s+\*\s*([\S]+)\s*\(/);
    if (methodAsyncGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodName: methodAsyncGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(methodAsyncGeneratorMatch[0].length - 1),
        isAsync: true,
        isGenerator: true
      };
    }
    const methodAsyncMatch = fnSource.match(/^async\s+([\S]+)\s*\(/);
    if (methodAsyncMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodName: methodAsyncMatch[1],
        argsAndBodySource: fnSource.slice(methodAsyncMatch[0].length - 1),
        isAsync: true,
        methodAsyncMatch
      };
    }
    const methodGeneratorMatch = fnSource.match(/^\*\s*([\S]+)\s*\(/);
    if (methodGeneratorMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodName: methodGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(methodGeneratorMatch[0].length - 1),
        isGenerator: true
      };
    }
    const methodMatch = fnSource.match(/^([\S]+)\s*\(/);
    if (methodMatch) {
      return {
        ...defaultFunctionAnalysis,
        type: "method",
        methodName: methodMatch[1],
        argsAndBodySource: fnSource.slice(methodMatch[0].length - 1)
      };
    }
  }
  return defaultFunctionAnalysis;
};
const defaultFunctionAnalysis = {
  type: "",
  // "classic", "method", "arrow", "class"
  name: "",
  extendedClassName: "",
  methodNameIsComputed: false,
  methodName: "",
  getterName: "",
  setterName: "",
  isAsync: false,
  isGenerator: false,
  argsAndBodySource: ""
};

const tokenizeInteger = integerValue => {
  const integerAsString = String(integerValue);
  const exponentIndex = integerAsString.indexOf("e");
  if (exponentIndex === -1) {
    return {
      integer: integerAsString
    };
  }
  const digitsAsString = integerAsString.slice(0, exponentIndex);
  const digitsValue = parseFloat(digitsAsString);
  const digitParts = tokenizeNonExponentialFloat(digitsValue);
  const digitsInteger = digitParts.integer;
  const digitsDecimal = digitParts.decimal;
  const afterExponent = integerAsString.slice(exponentIndex + 2); // "e" + "+"
  const numberOfTrailingZero = parseInt(afterExponent);
  let integer = "";
  integer = digitsInteger;
  integer += digitsDecimal;
  integer += afterExponent;
  integer += "0".repeat(numberOfTrailingZero);
  return {
    integer
  };
};

// see https://github.com/shrpne/from-exponential/blob/master/src/index.js
// https://github.com/shrpne/from-exponential/blob/master/test/index.test.js
const tokenizeFloat = floatValue => {
  const floatAsString = String(floatValue);
  const exponentIndex = floatAsString.indexOf("e");
  if (exponentIndex === -1) {
    return tokenizeNonExponentialFloat(floatValue);
  }
  let decimal = "";
  let numberOfLeadingZero;
  const digitsAsString = floatAsString.slice(0, exponentIndex);
  const digitsValue = parseFloat(digitsAsString);
  const digitParts = tokenizeNonExponentialFloat(digitsValue);
  const digitsInteger = digitParts.integer;
  const digitsDecimal = digitParts.decimal;
  const decimalSeparator = digitsDecimal ? digitParts.decimalSeparator : ".";
  const afterExponent = floatAsString.slice(exponentIndex + 2); // "e" + "-"
  numberOfLeadingZero = parseInt(afterExponent);
  decimal += "0".repeat(numberOfLeadingZero);
  decimal += digitsInteger;
  decimal += digitsDecimal;
  return {
    integer: "0",
    decimalSeparator,
    decimal
  };
};
const tokenizeNonExponentialFloat = floatValue => {
  const floatString = String(floatValue);
  const integer = Math.floor(floatValue);
  const integerAsString = String(integer);
  const decimalSeparator = floatString[integerAsString.length];
  const decimal = floatString.slice(integerAsString.length + 1);
  return {
    integer: integerAsString,
    decimalSeparator,
    decimal
  };
};

// tokenizeFloat(1.2e-7);
// tokenizeFloat(2e-7);

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
var lib = {};
var Graphemer$1 = {};
var boundaries = {};
(function (exports) {
  /**
   * The Grapheme_Cluster_Break property value
   * @see https://www.unicode.org/reports/tr29/#Default_Grapheme_Cluster_Table
   */
  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.EXTENDED_PICTOGRAPHIC = exports.CLUSTER_BREAK = void 0;
  (function (CLUSTER_BREAK) {
    CLUSTER_BREAK[CLUSTER_BREAK["CR"] = 0] = "CR";
    CLUSTER_BREAK[CLUSTER_BREAK["LF"] = 1] = "LF";
    CLUSTER_BREAK[CLUSTER_BREAK["CONTROL"] = 2] = "CONTROL";
    CLUSTER_BREAK[CLUSTER_BREAK["EXTEND"] = 3] = "EXTEND";
    CLUSTER_BREAK[CLUSTER_BREAK["REGIONAL_INDICATOR"] = 4] = "REGIONAL_INDICATOR";
    CLUSTER_BREAK[CLUSTER_BREAK["SPACINGMARK"] = 5] = "SPACINGMARK";
    CLUSTER_BREAK[CLUSTER_BREAK["L"] = 6] = "L";
    CLUSTER_BREAK[CLUSTER_BREAK["V"] = 7] = "V";
    CLUSTER_BREAK[CLUSTER_BREAK["T"] = 8] = "T";
    CLUSTER_BREAK[CLUSTER_BREAK["LV"] = 9] = "LV";
    CLUSTER_BREAK[CLUSTER_BREAK["LVT"] = 10] = "LVT";
    CLUSTER_BREAK[CLUSTER_BREAK["OTHER"] = 11] = "OTHER";
    CLUSTER_BREAK[CLUSTER_BREAK["PREPEND"] = 12] = "PREPEND";
    CLUSTER_BREAK[CLUSTER_BREAK["E_BASE"] = 13] = "E_BASE";
    CLUSTER_BREAK[CLUSTER_BREAK["E_MODIFIER"] = 14] = "E_MODIFIER";
    CLUSTER_BREAK[CLUSTER_BREAK["ZWJ"] = 15] = "ZWJ";
    CLUSTER_BREAK[CLUSTER_BREAK["GLUE_AFTER_ZWJ"] = 16] = "GLUE_AFTER_ZWJ";
    CLUSTER_BREAK[CLUSTER_BREAK["E_BASE_GAZ"] = 17] = "E_BASE_GAZ";
  })(exports.CLUSTER_BREAK || (exports.CLUSTER_BREAK = {}));
  /**
   * The Emoji character property is an extension of UCD but shares the same namespace and structure
   * @see http://www.unicode.org/reports/tr51/tr51-14.html#Emoji_Properties_and_Data_Files
   *
   * Here we model Extended_Pictograhpic only to implement UAX #29 GB11
   * \p{Extended_Pictographic} Extend* ZWJ	×	\p{Extended_Pictographic}
   *
   * The Emoji character property should not be mixed with Grapheme_Cluster_Break since they are not exclusive
   */
  exports.EXTENDED_PICTOGRAPHIC = 101;
})(boundaries);
var GraphemerHelper$1 = {};
Object.defineProperty(GraphemerHelper$1, "__esModule", {
  value: true
});
const boundaries_1$1 = boundaries;
// BreakTypes
// @type {BreakType}
const NotBreak = 0;
const BreakStart = 1;
const Break = 2;
const BreakLastRegional = 3;
const BreakPenultimateRegional = 4;
class GraphemerHelper {
  /**
   * Check if the the character at the position {pos} of the string is surrogate
   * @param str {string}
   * @param pos {number}
   * @returns {boolean}
   */
  static isSurrogate(str, pos) {
    return 0xd800 <= str.charCodeAt(pos) && str.charCodeAt(pos) <= 0xdbff && 0xdc00 <= str.charCodeAt(pos + 1) && str.charCodeAt(pos + 1) <= 0xdfff;
  }
  /**
   * The String.prototype.codePointAt polyfill
   * Private function, gets a Unicode code point from a JavaScript UTF-16 string
   * handling surrogate pairs appropriately
   * @param str {string}
   * @param idx {number}
   * @returns {number}
   */
  static codePointAt(str, idx) {
    if (idx === undefined) {
      idx = 0;
    }
    const code = str.charCodeAt(idx);
    // if a high surrogate
    if (0xd800 <= code && code <= 0xdbff && idx < str.length - 1) {
      const hi = code;
      const low = str.charCodeAt(idx + 1);
      if (0xdc00 <= low && low <= 0xdfff) {
        return (hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
      }
      return hi;
    }
    // if a low surrogate
    if (0xdc00 <= code && code <= 0xdfff && idx >= 1) {
      const hi = str.charCodeAt(idx - 1);
      const low = code;
      if (0xd800 <= hi && hi <= 0xdbff) {
        return (hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
      }
      return low;
    }
    // just return the char if an unmatched surrogate half or a
    // single-char codepoint
    return code;
  }
  //
  /**
   * Private function, returns whether a break is allowed between the two given grapheme breaking classes
   * Implemented the UAX #29 3.1.1 Grapheme Cluster Boundary Rules on extended grapheme clusters
   * @param start {number}
   * @param mid {Array<number>}
   * @param end {number}
   * @param startEmoji {number}
   * @param midEmoji {Array<number>}
   * @param endEmoji {number}
   * @returns {number}
   */
  static shouldBreak(start, mid, end, startEmoji, midEmoji, endEmoji) {
    const all = [start].concat(mid).concat([end]);
    const allEmoji = [startEmoji].concat(midEmoji).concat([endEmoji]);
    const previous = all[all.length - 2];
    const next = end;
    const nextEmoji = endEmoji;
    // Lookahead terminator for:
    // GB12. ^ (RI RI)* RI ? RI
    // GB13. [^RI] (RI RI)* RI ? RI
    const rIIndex = all.lastIndexOf(boundaries_1$1.CLUSTER_BREAK.REGIONAL_INDICATOR);
    if (rIIndex > 0 && all.slice(1, rIIndex).every(function (c) {
      return c === boundaries_1$1.CLUSTER_BREAK.REGIONAL_INDICATOR;
    }) && [boundaries_1$1.CLUSTER_BREAK.PREPEND, boundaries_1$1.CLUSTER_BREAK.REGIONAL_INDICATOR].indexOf(previous) === -1) {
      if (all.filter(function (c) {
        return c === boundaries_1$1.CLUSTER_BREAK.REGIONAL_INDICATOR;
      }).length % 2 === 1) {
        return BreakLastRegional;
      } else {
        return BreakPenultimateRegional;
      }
    }
    // GB3. CR × LF
    if (previous === boundaries_1$1.CLUSTER_BREAK.CR && next === boundaries_1$1.CLUSTER_BREAK.LF) {
      return NotBreak;
    }
    // GB4. (Control|CR|LF) ÷
    else if (previous === boundaries_1$1.CLUSTER_BREAK.CONTROL || previous === boundaries_1$1.CLUSTER_BREAK.CR || previous === boundaries_1$1.CLUSTER_BREAK.LF) {
      return BreakStart;
    }
    // GB5. ÷ (Control|CR|LF)
    else if (next === boundaries_1$1.CLUSTER_BREAK.CONTROL || next === boundaries_1$1.CLUSTER_BREAK.CR || next === boundaries_1$1.CLUSTER_BREAK.LF) {
      return BreakStart;
    }
    // GB6. L × (L|V|LV|LVT)
    else if (previous === boundaries_1$1.CLUSTER_BREAK.L && (next === boundaries_1$1.CLUSTER_BREAK.L || next === boundaries_1$1.CLUSTER_BREAK.V || next === boundaries_1$1.CLUSTER_BREAK.LV || next === boundaries_1$1.CLUSTER_BREAK.LVT)) {
      return NotBreak;
    }
    // GB7. (LV|V) × (V|T)
    else if ((previous === boundaries_1$1.CLUSTER_BREAK.LV || previous === boundaries_1$1.CLUSTER_BREAK.V) && (next === boundaries_1$1.CLUSTER_BREAK.V || next === boundaries_1$1.CLUSTER_BREAK.T)) {
      return NotBreak;
    }
    // GB8. (LVT|T) × (T)
    else if ((previous === boundaries_1$1.CLUSTER_BREAK.LVT || previous === boundaries_1$1.CLUSTER_BREAK.T) && next === boundaries_1$1.CLUSTER_BREAK.T) {
      return NotBreak;
    }
    // GB9. × (Extend|ZWJ)
    else if (next === boundaries_1$1.CLUSTER_BREAK.EXTEND || next === boundaries_1$1.CLUSTER_BREAK.ZWJ) {
      return NotBreak;
    }
    // GB9a. × SpacingMark
    else if (next === boundaries_1$1.CLUSTER_BREAK.SPACINGMARK) {
      return NotBreak;
    }
    // GB9b. Prepend ×
    else if (previous === boundaries_1$1.CLUSTER_BREAK.PREPEND) {
      return NotBreak;
    }
    // GB11. \p{Extended_Pictographic} Extend* ZWJ × \p{Extended_Pictographic}
    const previousNonExtendIndex = allEmoji.slice(0, -1).lastIndexOf(boundaries_1$1.EXTENDED_PICTOGRAPHIC);
    if (previousNonExtendIndex !== -1 && allEmoji[previousNonExtendIndex] === boundaries_1$1.EXTENDED_PICTOGRAPHIC && all.slice(previousNonExtendIndex + 1, -2).every(function (c) {
      return c === boundaries_1$1.CLUSTER_BREAK.EXTEND;
    }) && previous === boundaries_1$1.CLUSTER_BREAK.ZWJ && nextEmoji === boundaries_1$1.EXTENDED_PICTOGRAPHIC) {
      return NotBreak;
    }
    // GB12. ^ (RI RI)* RI × RI
    // GB13. [^RI] (RI RI)* RI × RI
    if (mid.indexOf(boundaries_1$1.CLUSTER_BREAK.REGIONAL_INDICATOR) !== -1) {
      return Break;
    }
    if (previous === boundaries_1$1.CLUSTER_BREAK.REGIONAL_INDICATOR && next === boundaries_1$1.CLUSTER_BREAK.REGIONAL_INDICATOR) {
      return NotBreak;
    }
    // GB999. Any ? Any
    return BreakStart;
  }
}
GraphemerHelper$1.default = GraphemerHelper;
var GraphemerIterator$1 = {};
Object.defineProperty(GraphemerIterator$1, "__esModule", {
  value: true
});
/**
 * GraphemerIterator
 *
 * Takes a string and a "BreakHandler" method during initialisation
 * and creates an iterable object that returns individual graphemes.
 *
 * @param str {string}
 * @return GraphemerIterator
 */
class GraphemerIterator {
  constructor(str, nextBreak) {
    this._index = 0;
    this._str = str;
    this._nextBreak = nextBreak;
  }
  [Symbol.iterator]() {
    return this;
  }
  next() {
    let brk;
    if ((brk = this._nextBreak(this._str, this._index)) < this._str.length) {
      const value = this._str.slice(this._index, brk);
      this._index = brk;
      return {
        value: value,
        done: false
      };
    }
    if (this._index < this._str.length) {
      const value = this._str.slice(this._index);
      this._index = this._str.length;
      return {
        value: value,
        done: false
      };
    }
    return {
      value: undefined,
      done: true
    };
  }
}
GraphemerIterator$1.default = GraphemerIterator;
var __importDefault$1 = commonjsGlobal && commonjsGlobal.__importDefault || function (mod) {
  return mod && mod.__esModule ? mod : {
    "default": mod
  };
};
Object.defineProperty(Graphemer$1, "__esModule", {
  value: true
});
const boundaries_1 = boundaries;
const GraphemerHelper_1 = __importDefault$1(GraphemerHelper$1);
const GraphemerIterator_1 = __importDefault$1(GraphemerIterator$1);
class Graphemer {
  /**
   * Returns the next grapheme break in the string after the given index
   * @param string {string}
   * @param index {number}
   * @returns {number}
   */
  static nextBreak(string, index) {
    if (index === undefined) {
      index = 0;
    }
    if (index < 0) {
      return 0;
    }
    if (index >= string.length - 1) {
      return string.length;
    }
    const prevCP = GraphemerHelper_1.default.codePointAt(string, index);
    const prev = Graphemer.getGraphemeBreakProperty(prevCP);
    const prevEmoji = Graphemer.getEmojiProperty(prevCP);
    const mid = [];
    const midEmoji = [];
    for (let i = index + 1; i < string.length; i++) {
      // check for already processed low surrogates
      if (GraphemerHelper_1.default.isSurrogate(string, i - 1)) {
        continue;
      }
      const nextCP = GraphemerHelper_1.default.codePointAt(string, i);
      const next = Graphemer.getGraphemeBreakProperty(nextCP);
      const nextEmoji = Graphemer.getEmojiProperty(nextCP);
      if (GraphemerHelper_1.default.shouldBreak(prev, mid, next, prevEmoji, midEmoji, nextEmoji)) {
        return i;
      }
      mid.push(next);
      midEmoji.push(nextEmoji);
    }
    return string.length;
  }
  /**
   * Breaks the given string into an array of grapheme clusters
   * @param str {string}
   * @returns {string[]}
   */
  splitGraphemes(str) {
    const res = [];
    let index = 0;
    let brk;
    while ((brk = Graphemer.nextBreak(str, index)) < str.length) {
      res.push(str.slice(index, brk));
      index = brk;
    }
    if (index < str.length) {
      res.push(str.slice(index));
    }
    return res;
  }
  /**
   * Returns an iterator of grapheme clusters in the given string
   * @param str {string}
   * @returns {GraphemerIterator}
   */
  iterateGraphemes(str) {
    return new GraphemerIterator_1.default(str, Graphemer.nextBreak);
  }
  /**
   * Returns the number of grapheme clusters in the given string
   * @param str {string}
   * @returns {number}
   */
  countGraphemes(str) {
    let count = 0;
    let index = 0;
    let brk;
    while ((brk = Graphemer.nextBreak(str, index)) < str.length) {
      index = brk;
      count++;
    }
    if (index < str.length) {
      count++;
    }
    return count;
  }
  /**
   * Given a Unicode code point, determines this symbol's grapheme break property
   * @param code {number} Unicode code point
   * @returns {number}
   */
  static getGraphemeBreakProperty(code) {
    // Grapheme break property taken from:
    // https://www.unicode.org/Public/UCD/latest/ucd/auxiliary/GraphemeBreakProperty.txt
    // and generated by
    // node ./scripts/generate-grapheme-break.js
    if (code < 0xbf09) {
      if (code < 0xac54) {
        if (code < 0x102d) {
          if (code < 0xb02) {
            if (code < 0x93b) {
              if (code < 0x6df) {
                if (code < 0x5bf) {
                  if (code < 0x7f) {
                    if (code < 0xb) {
                      if (code < 0xa) {
                        // Cc  [10] <control-0000>..<control-0009>
                        if (0x0 <= code && code <= 0x9) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      } else {
                        // Cc       <control-000A>
                        if (0xa === code) {
                          return boundaries_1.CLUSTER_BREAK.LF;
                        }
                      }
                    } else {
                      if (code < 0xd) {
                        // Cc   [2] <control-000B>..<control-000C>
                        if (0xb <= code && code <= 0xc) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      } else {
                        if (code < 0xe) {
                          // Cc       <control-000D>
                          if (0xd === code) {
                            return boundaries_1.CLUSTER_BREAK.CR;
                          }
                        } else {
                          // Cc  [18] <control-000E>..<control-001F>
                          if (0xe <= code && code <= 0x1f) {
                            return boundaries_1.CLUSTER_BREAK.CONTROL;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x300) {
                      if (code < 0xad) {
                        // Cc  [33] <control-007F>..<control-009F>
                        if (0x7f <= code && code <= 0x9f) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      } else {
                        // Cf       SOFT HYPHEN
                        if (0xad === code) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      }
                    } else {
                      if (code < 0x483) {
                        // Mn [112] COMBINING GRAVE ACCENT..COMBINING LATIN SMALL LETTER X
                        if (0x300 <= code && code <= 0x36f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x591) {
                          // Mn   [5] COMBINING CYRILLIC TITLO..COMBINING CYRILLIC POKRYTIE
                          // Me   [2] COMBINING CYRILLIC HUNDRED THOUSANDS SIGN..COMBINING CYRILLIC MILLIONS SIGN
                          if (0x483 <= code && code <= 0x489) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn  [45] HEBREW ACCENT ETNAHTA..HEBREW POINT METEG
                          if (0x591 <= code && code <= 0x5bd) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x610) {
                    if (code < 0x5c4) {
                      if (code < 0x5c1) {
                        // Mn       HEBREW POINT RAFE
                        if (0x5bf === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [2] HEBREW POINT SHIN DOT..HEBREW POINT SIN DOT
                        if (0x5c1 <= code && code <= 0x5c2) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x5c7) {
                        // Mn   [2] HEBREW MARK UPPER DOT..HEBREW MARK LOWER DOT
                        if (0x5c4 <= code && code <= 0x5c5) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x600) {
                          // Mn       HEBREW POINT QAMATS QATAN
                          if (0x5c7 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Cf   [6] ARABIC NUMBER SIGN..ARABIC NUMBER MARK ABOVE
                          if (0x600 <= code && code <= 0x605) {
                            return boundaries_1.CLUSTER_BREAK.PREPEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x670) {
                      if (code < 0x61c) {
                        // Mn  [11] ARABIC SIGN SALLALLAHOU ALAYHE WASSALLAM..ARABIC SMALL KASRA
                        if (0x610 <= code && code <= 0x61a) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x64b) {
                          // Cf       ARABIC LETTER MARK
                          if (0x61c === code) {
                            return boundaries_1.CLUSTER_BREAK.CONTROL;
                          }
                        } else {
                          // Mn  [21] ARABIC FATHATAN..ARABIC WAVY HAMZA BELOW
                          if (0x64b <= code && code <= 0x65f) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x6d6) {
                        // Mn       ARABIC LETTER SUPERSCRIPT ALEF
                        if (0x670 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x6dd) {
                          // Mn   [7] ARABIC SMALL HIGH LIGATURE SAD WITH LAM WITH ALEF MAKSURA..ARABIC SMALL HIGH SEEN
                          if (0x6d6 <= code && code <= 0x6dc) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Cf       ARABIC END OF AYAH
                          if (0x6dd === code) {
                            return boundaries_1.CLUSTER_BREAK.PREPEND;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x81b) {
                  if (code < 0x730) {
                    if (code < 0x6ea) {
                      if (code < 0x6e7) {
                        // Mn   [6] ARABIC SMALL HIGH ROUNDED ZERO..ARABIC SMALL HIGH MADDA
                        if (0x6df <= code && code <= 0x6e4) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [2] ARABIC SMALL HIGH YEH..ARABIC SMALL HIGH NOON
                        if (0x6e7 <= code && code <= 0x6e8) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x70f) {
                        // Mn   [4] ARABIC EMPTY CENTRE LOW STOP..ARABIC SMALL LOW MEEM
                        if (0x6ea <= code && code <= 0x6ed) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Cf       SYRIAC ABBREVIATION MARK
                        if (0x70f === code) {
                          return boundaries_1.CLUSTER_BREAK.PREPEND;
                        }
                        // Mn       SYRIAC LETTER SUPERSCRIPT ALAPH
                        if (0x711 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0x7eb) {
                      if (code < 0x7a6) {
                        // Mn  [27] SYRIAC PTHAHA ABOVE..SYRIAC BARREKH
                        if (0x730 <= code && code <= 0x74a) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn  [11] THAANA ABAFILI..THAANA SUKUN
                        if (0x7a6 <= code && code <= 0x7b0) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x7fd) {
                        // Mn   [9] NKO COMBINING SHORT HIGH TONE..NKO COMBINING DOUBLE DOT ABOVE
                        if (0x7eb <= code && code <= 0x7f3) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x816) {
                          // Mn       NKO DANTAYALAN
                          if (0x7fd === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [4] SAMARITAN MARK IN..SAMARITAN MARK DAGESH
                          if (0x816 <= code && code <= 0x819) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x898) {
                    if (code < 0x829) {
                      if (code < 0x825) {
                        // Mn   [9] SAMARITAN MARK EPENTHETIC YUT..SAMARITAN VOWEL SIGN A
                        if (0x81b <= code && code <= 0x823) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [3] SAMARITAN VOWEL SIGN SHORT A..SAMARITAN VOWEL SIGN U
                        if (0x825 <= code && code <= 0x827) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x859) {
                        // Mn   [5] SAMARITAN VOWEL SIGN LONG I..SAMARITAN MARK NEQUDAA
                        if (0x829 <= code && code <= 0x82d) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x890) {
                          // Mn   [3] MANDAIC AFFRICATION MARK..MANDAIC GEMINATION MARK
                          if (0x859 <= code && code <= 0x85b) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Cf   [2] ARABIC POUND MARK ABOVE..ARABIC PIASTRE MARK ABOVE
                          if (0x890 <= code && code <= 0x891) {
                            return boundaries_1.CLUSTER_BREAK.PREPEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x8e3) {
                      if (code < 0x8ca) {
                        // Mn   [8] ARABIC SMALL HIGH WORD AL-JUZ..ARABIC HALF MADDA OVER MADDA
                        if (0x898 <= code && code <= 0x89f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x8e2) {
                          // Mn  [24] ARABIC SMALL HIGH FARSI YEH..ARABIC SMALL HIGH SIGN SAFHA
                          if (0x8ca <= code && code <= 0x8e1) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Cf       ARABIC DISPUTED END OF AYAH
                          if (0x8e2 === code) {
                            return boundaries_1.CLUSTER_BREAK.PREPEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x903) {
                        // Mn  [32] ARABIC TURNED DAMMA BELOW..DEVANAGARI SIGN ANUSVARA
                        if (0x8e3 <= code && code <= 0x902) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       DEVANAGARI SIGN VISARGA
                        if (0x903 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                        // Mn       DEVANAGARI VOWEL SIGN OE
                        if (0x93a === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xa01) {
                if (code < 0x982) {
                  if (code < 0x94d) {
                    if (code < 0x93e) {
                      // Mc       DEVANAGARI VOWEL SIGN OOE
                      if (0x93b === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                      // Mn       DEVANAGARI SIGN NUKTA
                      if (0x93c === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0x941) {
                        // Mc   [3] DEVANAGARI VOWEL SIGN AA..DEVANAGARI VOWEL SIGN II
                        if (0x93e <= code && code <= 0x940) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x949) {
                          // Mn   [8] DEVANAGARI VOWEL SIGN U..DEVANAGARI VOWEL SIGN AI
                          if (0x941 <= code && code <= 0x948) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [4] DEVANAGARI VOWEL SIGN CANDRA O..DEVANAGARI VOWEL SIGN AU
                          if (0x949 <= code && code <= 0x94c) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x951) {
                      if (code < 0x94e) {
                        // Mn       DEVANAGARI SIGN VIRAMA
                        if (0x94d === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc   [2] DEVANAGARI VOWEL SIGN PRISHTHAMATRA E..DEVANAGARI VOWEL SIGN AW
                        if (0x94e <= code && code <= 0x94f) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x962) {
                        // Mn   [7] DEVANAGARI STRESS SIGN UDATTA..DEVANAGARI VOWEL SIGN UUE
                        if (0x951 <= code && code <= 0x957) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x981) {
                          // Mn   [2] DEVANAGARI VOWEL SIGN VOCALIC L..DEVANAGARI VOWEL SIGN VOCALIC LL
                          if (0x962 <= code && code <= 0x963) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       BENGALI SIGN CANDRABINDU
                          if (0x981 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x9c7) {
                    if (code < 0x9be) {
                      if (code < 0x9bc) {
                        // Mc   [2] BENGALI SIGN ANUSVARA..BENGALI SIGN VISARGA
                        if (0x982 <= code && code <= 0x983) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       BENGALI SIGN NUKTA
                        if (0x9bc === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x9bf) {
                        // Mc       BENGALI VOWEL SIGN AA
                        if (0x9be === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x9c1) {
                          // Mc   [2] BENGALI VOWEL SIGN I..BENGALI VOWEL SIGN II
                          if (0x9bf <= code && code <= 0x9c0) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [4] BENGALI VOWEL SIGN U..BENGALI VOWEL SIGN VOCALIC RR
                          if (0x9c1 <= code && code <= 0x9c4) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x9d7) {
                      if (code < 0x9cb) {
                        // Mc   [2] BENGALI VOWEL SIGN E..BENGALI VOWEL SIGN AI
                        if (0x9c7 <= code && code <= 0x9c8) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x9cd) {
                          // Mc   [2] BENGALI VOWEL SIGN O..BENGALI VOWEL SIGN AU
                          if (0x9cb <= code && code <= 0x9cc) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       BENGALI SIGN VIRAMA
                          if (0x9cd === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x9e2) {
                        // Mc       BENGALI AU LENGTH MARK
                        if (0x9d7 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x9fe) {
                          // Mn   [2] BENGALI VOWEL SIGN VOCALIC L..BENGALI VOWEL SIGN VOCALIC LL
                          if (0x9e2 <= code && code <= 0x9e3) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       BENGALI SANDHI MARK
                          if (0x9fe === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xa83) {
                  if (code < 0xa47) {
                    if (code < 0xa3c) {
                      if (code < 0xa03) {
                        // Mn   [2] GURMUKHI SIGN ADAK BINDI..GURMUKHI SIGN BINDI
                        if (0xa01 <= code && code <= 0xa02) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       GURMUKHI SIGN VISARGA
                        if (0xa03 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0xa3e) {
                        // Mn       GURMUKHI SIGN NUKTA
                        if (0xa3c === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xa41) {
                          // Mc   [3] GURMUKHI VOWEL SIGN AA..GURMUKHI VOWEL SIGN II
                          if (0xa3e <= code && code <= 0xa40) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [2] GURMUKHI VOWEL SIGN U..GURMUKHI VOWEL SIGN UU
                          if (0xa41 <= code && code <= 0xa42) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xa70) {
                      if (code < 0xa4b) {
                        // Mn   [2] GURMUKHI VOWEL SIGN EE..GURMUKHI VOWEL SIGN AI
                        if (0xa47 <= code && code <= 0xa48) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xa51) {
                          // Mn   [3] GURMUKHI VOWEL SIGN OO..GURMUKHI SIGN VIRAMA
                          if (0xa4b <= code && code <= 0xa4d) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       GURMUKHI SIGN UDAAT
                          if (0xa51 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0xa75) {
                        // Mn   [2] GURMUKHI TIPPI..GURMUKHI ADDAK
                        if (0xa70 <= code && code <= 0xa71) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xa81) {
                          // Mn       GURMUKHI SIGN YAKASH
                          if (0xa75 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] GUJARATI SIGN CANDRABINDU..GUJARATI SIGN ANUSVARA
                          if (0xa81 <= code && code <= 0xa82) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xac9) {
                    if (code < 0xabe) {
                      // Mc       GUJARATI SIGN VISARGA
                      if (0xa83 === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                      // Mn       GUJARATI SIGN NUKTA
                      if (0xabc === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0xac1) {
                        // Mc   [3] GUJARATI VOWEL SIGN AA..GUJARATI VOWEL SIGN II
                        if (0xabe <= code && code <= 0xac0) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xac7) {
                          // Mn   [5] GUJARATI VOWEL SIGN U..GUJARATI VOWEL SIGN CANDRA E
                          if (0xac1 <= code && code <= 0xac5) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] GUJARATI VOWEL SIGN E..GUJARATI VOWEL SIGN AI
                          if (0xac7 <= code && code <= 0xac8) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xae2) {
                      if (code < 0xacb) {
                        // Mc       GUJARATI VOWEL SIGN CANDRA O
                        if (0xac9 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xacd) {
                          // Mc   [2] GUJARATI VOWEL SIGN O..GUJARATI VOWEL SIGN AU
                          if (0xacb <= code && code <= 0xacc) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       GUJARATI SIGN VIRAMA
                          if (0xacd === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0xafa) {
                        // Mn   [2] GUJARATI VOWEL SIGN VOCALIC L..GUJARATI VOWEL SIGN VOCALIC LL
                        if (0xae2 <= code && code <= 0xae3) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xb01) {
                          // Mn   [6] GUJARATI SIGN SUKUN..GUJARATI SIGN TWO-CIRCLE NUKTA ABOVE
                          if (0xafa <= code && code <= 0xaff) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       ORIYA SIGN CANDRABINDU
                          if (0xb01 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 0xcf3) {
              if (code < 0xc04) {
                if (code < 0xb82) {
                  if (code < 0xb47) {
                    if (code < 0xb3e) {
                      if (code < 0xb3c) {
                        // Mc   [2] ORIYA SIGN ANUSVARA..ORIYA SIGN VISARGA
                        if (0xb02 <= code && code <= 0xb03) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       ORIYA SIGN NUKTA
                        if (0xb3c === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xb40) {
                        // Mc       ORIYA VOWEL SIGN AA
                        // Mn       ORIYA VOWEL SIGN I
                        if (0xb3e <= code && code <= 0xb3f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xb41) {
                          // Mc       ORIYA VOWEL SIGN II
                          if (0xb40 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [4] ORIYA VOWEL SIGN U..ORIYA VOWEL SIGN VOCALIC RR
                          if (0xb41 <= code && code <= 0xb44) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb4d) {
                      if (code < 0xb4b) {
                        // Mc   [2] ORIYA VOWEL SIGN E..ORIYA VOWEL SIGN AI
                        if (0xb47 <= code && code <= 0xb48) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mc   [2] ORIYA VOWEL SIGN O..ORIYA VOWEL SIGN AU
                        if (0xb4b <= code && code <= 0xb4c) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0xb55) {
                        // Mn       ORIYA SIGN VIRAMA
                        if (0xb4d === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xb62) {
                          // Mn   [2] ORIYA SIGN OVERLINE..ORIYA AI LENGTH MARK
                          // Mc       ORIYA AU LENGTH MARK
                          if (0xb55 <= code && code <= 0xb57) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] ORIYA VOWEL SIGN VOCALIC L..ORIYA VOWEL SIGN VOCALIC LL
                          if (0xb62 <= code && code <= 0xb63) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xbc6) {
                    if (code < 0xbbf) {
                      // Mn       TAMIL SIGN ANUSVARA
                      if (0xb82 === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                      // Mc       TAMIL VOWEL SIGN AA
                      if (0xbbe === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0xbc0) {
                        // Mc       TAMIL VOWEL SIGN I
                        if (0xbbf === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xbc1) {
                          // Mn       TAMIL VOWEL SIGN II
                          if (0xbc0 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] TAMIL VOWEL SIGN U..TAMIL VOWEL SIGN UU
                          if (0xbc1 <= code && code <= 0xbc2) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbd7) {
                      if (code < 0xbca) {
                        // Mc   [3] TAMIL VOWEL SIGN E..TAMIL VOWEL SIGN AI
                        if (0xbc6 <= code && code <= 0xbc8) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xbcd) {
                          // Mc   [3] TAMIL VOWEL SIGN O..TAMIL VOWEL SIGN AU
                          if (0xbca <= code && code <= 0xbcc) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       TAMIL SIGN VIRAMA
                          if (0xbcd === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc00) {
                        // Mc       TAMIL AU LENGTH MARK
                        if (0xbd7 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xc01) {
                          // Mn       TELUGU SIGN COMBINING CANDRABINDU ABOVE
                          if (0xc00 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [3] TELUGU SIGN CANDRABINDU..TELUGU SIGN VISARGA
                          if (0xc01 <= code && code <= 0xc03) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xcbe) {
                  if (code < 0xc4a) {
                    if (code < 0xc3e) {
                      // Mn       TELUGU SIGN COMBINING ANUSVARA ABOVE
                      if (0xc04 === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                      // Mn       TELUGU SIGN NUKTA
                      if (0xc3c === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0xc41) {
                        // Mn   [3] TELUGU VOWEL SIGN AA..TELUGU VOWEL SIGN II
                        if (0xc3e <= code && code <= 0xc40) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xc46) {
                          // Mc   [4] TELUGU VOWEL SIGN U..TELUGU VOWEL SIGN VOCALIC RR
                          if (0xc41 <= code && code <= 0xc44) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [3] TELUGU VOWEL SIGN E..TELUGU VOWEL SIGN AI
                          if (0xc46 <= code && code <= 0xc48) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc81) {
                      if (code < 0xc55) {
                        // Mn   [4] TELUGU VOWEL SIGN O..TELUGU SIGN VIRAMA
                        if (0xc4a <= code && code <= 0xc4d) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xc62) {
                          // Mn   [2] TELUGU LENGTH MARK..TELUGU AI LENGTH MARK
                          if (0xc55 <= code && code <= 0xc56) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] TELUGU VOWEL SIGN VOCALIC L..TELUGU VOWEL SIGN VOCALIC LL
                          if (0xc62 <= code && code <= 0xc63) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc82) {
                        // Mn       KANNADA SIGN CANDRABINDU
                        if (0xc81 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xcbc) {
                          // Mc   [2] KANNADA SIGN ANUSVARA..KANNADA SIGN VISARGA
                          if (0xc82 <= code && code <= 0xc83) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       KANNADA SIGN NUKTA
                          if (0xcbc === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xcc6) {
                    if (code < 0xcc0) {
                      // Mc       KANNADA VOWEL SIGN AA
                      if (0xcbe === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                      // Mn       KANNADA VOWEL SIGN I
                      if (0xcbf === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0xcc2) {
                        // Mc   [2] KANNADA VOWEL SIGN II..KANNADA VOWEL SIGN U
                        if (0xcc0 <= code && code <= 0xcc1) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xcc3) {
                          // Mc       KANNADA VOWEL SIGN UU
                          if (0xcc2 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] KANNADA VOWEL SIGN VOCALIC R..KANNADA VOWEL SIGN VOCALIC RR
                          if (0xcc3 <= code && code <= 0xcc4) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xccc) {
                      if (code < 0xcc7) {
                        // Mn       KANNADA VOWEL SIGN E
                        if (0xcc6 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xcca) {
                          // Mc   [2] KANNADA VOWEL SIGN EE..KANNADA VOWEL SIGN AI
                          if (0xcc7 <= code && code <= 0xcc8) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mc   [2] KANNADA VOWEL SIGN O..KANNADA VOWEL SIGN OO
                          if (0xcca <= code && code <= 0xccb) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0xcd5) {
                        // Mn   [2] KANNADA VOWEL SIGN AU..KANNADA SIGN VIRAMA
                        if (0xccc <= code && code <= 0xccd) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xce2) {
                          // Mc   [2] KANNADA LENGTH MARK..KANNADA AI LENGTH MARK
                          if (0xcd5 <= code && code <= 0xcd6) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] KANNADA VOWEL SIGN VOCALIC L..KANNADA VOWEL SIGN VOCALIC LL
                          if (0xce2 <= code && code <= 0xce3) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xddf) {
                if (code < 0xd4e) {
                  if (code < 0xd3f) {
                    if (code < 0xd02) {
                      if (code < 0xd00) {
                        // Mc       KANNADA SIGN COMBINING ANUSVARA ABOVE RIGHT
                        if (0xcf3 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [2] MALAYALAM SIGN COMBINING ANUSVARA ABOVE..MALAYALAM SIGN CANDRABINDU
                        if (0xd00 <= code && code <= 0xd01) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xd3b) {
                        // Mc   [2] MALAYALAM SIGN ANUSVARA..MALAYALAM SIGN VISARGA
                        if (0xd02 <= code && code <= 0xd03) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xd3e) {
                          // Mn   [2] MALAYALAM SIGN VERTICAL BAR VIRAMA..MALAYALAM SIGN CIRCULAR VIRAMA
                          if (0xd3b <= code && code <= 0xd3c) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc       MALAYALAM VOWEL SIGN AA
                          if (0xd3e === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd46) {
                      if (code < 0xd41) {
                        // Mc   [2] MALAYALAM VOWEL SIGN I..MALAYALAM VOWEL SIGN II
                        if (0xd3f <= code && code <= 0xd40) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [4] MALAYALAM VOWEL SIGN U..MALAYALAM VOWEL SIGN VOCALIC RR
                        if (0xd41 <= code && code <= 0xd44) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xd4a) {
                        // Mc   [3] MALAYALAM VOWEL SIGN E..MALAYALAM VOWEL SIGN AI
                        if (0xd46 <= code && code <= 0xd48) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xd4d) {
                          // Mc   [3] MALAYALAM VOWEL SIGN O..MALAYALAM VOWEL SIGN AU
                          if (0xd4a <= code && code <= 0xd4c) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       MALAYALAM SIGN VIRAMA
                          if (0xd4d === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xdca) {
                    if (code < 0xd62) {
                      // Lo       MALAYALAM LETTER DOT REPH
                      if (0xd4e === code) {
                        return boundaries_1.CLUSTER_BREAK.PREPEND;
                      }
                      // Mc       MALAYALAM AU LENGTH MARK
                      if (0xd57 === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0xd81) {
                        // Mn   [2] MALAYALAM VOWEL SIGN VOCALIC L..MALAYALAM VOWEL SIGN VOCALIC LL
                        if (0xd62 <= code && code <= 0xd63) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xd82) {
                          // Mn       SINHALA SIGN CANDRABINDU
                          if (0xd81 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] SINHALA SIGN ANUSVARAYA..SINHALA SIGN VISARGAYA
                          if (0xd82 <= code && code <= 0xd83) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xdd2) {
                      if (code < 0xdcf) {
                        // Mn       SINHALA SIGN AL-LAKUNA
                        if (0xdca === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xdd0) {
                          // Mc       SINHALA VOWEL SIGN AELA-PILLA
                          if (0xdcf === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] SINHALA VOWEL SIGN KETTI AEDA-PILLA..SINHALA VOWEL SIGN DIGA AEDA-PILLA
                          if (0xdd0 <= code && code <= 0xdd1) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0xdd6) {
                        // Mn   [3] SINHALA VOWEL SIGN KETTI IS-PILLA..SINHALA VOWEL SIGN KETTI PAA-PILLA
                        if (0xdd2 <= code && code <= 0xdd4) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xdd8) {
                          // Mn       SINHALA VOWEL SIGN DIGA PAA-PILLA
                          if (0xdd6 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [7] SINHALA VOWEL SIGN GAETTA-PILLA..SINHALA VOWEL SIGN KOMBUVA HAA GAYANUKITTA
                          if (0xdd8 <= code && code <= 0xdde) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xf35) {
                  if (code < 0xe47) {
                    if (code < 0xe31) {
                      if (code < 0xdf2) {
                        // Mc       SINHALA VOWEL SIGN GAYANUKITTA
                        if (0xddf === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc   [2] SINHALA VOWEL SIGN DIGA GAETTA-PILLA..SINHALA VOWEL SIGN DIGA GAYANUKITTA
                        if (0xdf2 <= code && code <= 0xdf3) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0xe33) {
                        // Mn       THAI CHARACTER MAI HAN-AKAT
                        if (0xe31 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xe34) {
                          // Lo       THAI CHARACTER SARA AM
                          if (0xe33 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [7] THAI CHARACTER SARA I..THAI CHARACTER PHINTHU
                          if (0xe34 <= code && code <= 0xe3a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xeb4) {
                      if (code < 0xeb1) {
                        // Mn   [8] THAI CHARACTER MAITAIKHU..THAI CHARACTER YAMAKKAN
                        if (0xe47 <= code && code <= 0xe4e) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       LAO VOWEL SIGN MAI KAN
                        if (0xeb1 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Lo       LAO VOWEL SIGN AM
                        if (0xeb3 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0xec8) {
                        // Mn   [9] LAO VOWEL SIGN I..LAO SEMIVOWEL SIGN LO
                        if (0xeb4 <= code && code <= 0xebc) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xf18) {
                          // Mn   [7] LAO TONE MAI EK..LAO YAMAKKAN
                          if (0xec8 <= code && code <= 0xece) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] TIBETAN ASTROLOGICAL SIGN -KHYUD PA..TIBETAN ASTROLOGICAL SIGN SDONG TSHUGS
                          if (0xf18 <= code && code <= 0xf19) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xf7f) {
                    if (code < 0xf39) {
                      // Mn       TIBETAN MARK NGAS BZUNG NYI ZLA
                      if (0xf35 === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                      // Mn       TIBETAN MARK NGAS BZUNG SGOR RTAGS
                      if (0xf37 === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0xf3e) {
                        // Mn       TIBETAN MARK TSA -PHRU
                        if (0xf39 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xf71) {
                          // Mc   [2] TIBETAN SIGN YAR TSHES..TIBETAN SIGN MAR TSHES
                          if (0xf3e <= code && code <= 0xf3f) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn  [14] TIBETAN VOWEL SIGN AA..TIBETAN SIGN RJES SU NGA RO
                          if (0xf71 <= code && code <= 0xf7e) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xf8d) {
                      if (code < 0xf80) {
                        // Mc       TIBETAN SIGN RNAM BCAD
                        if (0xf7f === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xf86) {
                          // Mn   [5] TIBETAN VOWEL SIGN REVERSED I..TIBETAN MARK HALANTA
                          if (0xf80 <= code && code <= 0xf84) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] TIBETAN SIGN LCI RTAGS..TIBETAN SIGN YANG RTAGS
                          if (0xf86 <= code && code <= 0xf87) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0xf99) {
                        // Mn  [11] TIBETAN SUBJOINED SIGN LCE TSA CAN..TIBETAN SUBJOINED LETTER JA
                        if (0xf8d <= code && code <= 0xf97) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xfc6) {
                          // Mn  [36] TIBETAN SUBJOINED LETTER NYA..TIBETAN SUBJOINED LETTER FIXED-FORM RA
                          if (0xf99 <= code && code <= 0xfbc) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       TIBETAN SYMBOL PADMA GDAN
                          if (0xfc6 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          if (code < 0x1c24) {
            if (code < 0x1930) {
              if (code < 0x1732) {
                if (code < 0x1082) {
                  if (code < 0x103d) {
                    if (code < 0x1032) {
                      if (code < 0x1031) {
                        // Mn   [4] MYANMAR VOWEL SIGN I..MYANMAR VOWEL SIGN UU
                        if (0x102d <= code && code <= 0x1030) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       MYANMAR VOWEL SIGN E
                        if (0x1031 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x1039) {
                        // Mn   [6] MYANMAR VOWEL SIGN AI..MYANMAR SIGN DOT BELOW
                        if (0x1032 <= code && code <= 0x1037) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x103b) {
                          // Mn   [2] MYANMAR SIGN VIRAMA..MYANMAR SIGN ASAT
                          if (0x1039 <= code && code <= 0x103a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] MYANMAR CONSONANT SIGN MEDIAL YA..MYANMAR CONSONANT SIGN MEDIAL RA
                          if (0x103b <= code && code <= 0x103c) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1058) {
                      if (code < 0x1056) {
                        // Mn   [2] MYANMAR CONSONANT SIGN MEDIAL WA..MYANMAR CONSONANT SIGN MEDIAL HA
                        if (0x103d <= code && code <= 0x103e) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc   [2] MYANMAR VOWEL SIGN VOCALIC R..MYANMAR VOWEL SIGN VOCALIC RR
                        if (0x1056 <= code && code <= 0x1057) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x105e) {
                        // Mn   [2] MYANMAR VOWEL SIGN VOCALIC L..MYANMAR VOWEL SIGN VOCALIC LL
                        if (0x1058 <= code && code <= 0x1059) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1071) {
                          // Mn   [3] MYANMAR CONSONANT SIGN MON MEDIAL NA..MYANMAR CONSONANT SIGN MON MEDIAL LA
                          if (0x105e <= code && code <= 0x1060) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [4] MYANMAR VOWEL SIGN GEBA KAREN I..MYANMAR VOWEL SIGN KAYAH EE
                          if (0x1071 <= code && code <= 0x1074) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x1100) {
                    if (code < 0x1085) {
                      // Mn       MYANMAR CONSONANT SIGN SHAN MEDIAL WA
                      if (0x1082 === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                      // Mc       MYANMAR VOWEL SIGN SHAN E
                      if (0x1084 === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                    } else {
                      if (code < 0x108d) {
                        // Mn   [2] MYANMAR VOWEL SIGN SHAN E ABOVE..MYANMAR VOWEL SIGN SHAN FINAL Y
                        if (0x1085 <= code && code <= 0x1086) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       MYANMAR SIGN SHAN COUNCIL EMPHATIC TONE
                        if (0x108d === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mn       MYANMAR VOWEL SIGN AITON AI
                        if (0x109d === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0x135d) {
                      if (code < 0x1160) {
                        // Lo  [96] HANGUL CHOSEONG KIYEOK..HANGUL CHOSEONG FILLER
                        if (0x1100 <= code && code <= 0x115f) {
                          return boundaries_1.CLUSTER_BREAK.L;
                        }
                      } else {
                        if (code < 0x11a8) {
                          // Lo  [72] HANGUL JUNGSEONG FILLER..HANGUL JUNGSEONG O-YAE
                          if (0x1160 <= code && code <= 0x11a7) {
                            return boundaries_1.CLUSTER_BREAK.V;
                          }
                        } else {
                          // Lo  [88] HANGUL JONGSEONG KIYEOK..HANGUL JONGSEONG SSANGNIEUN
                          if (0x11a8 <= code && code <= 0x11ff) {
                            return boundaries_1.CLUSTER_BREAK.T;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1712) {
                        // Mn   [3] ETHIOPIC COMBINING GEMINATION AND VOWEL LENGTH MARK..ETHIOPIC COMBINING GEMINATION MARK
                        if (0x135d <= code && code <= 0x135f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1715) {
                          // Mn   [3] TAGALOG VOWEL SIGN I..TAGALOG SIGN VIRAMA
                          if (0x1712 <= code && code <= 0x1714) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc       TAGALOG SIGN PAMUDPOD
                          if (0x1715 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x17c9) {
                  if (code < 0x17b6) {
                    if (code < 0x1752) {
                      if (code < 0x1734) {
                        // Mn   [2] HANUNOO VOWEL SIGN I..HANUNOO VOWEL SIGN U
                        if (0x1732 <= code && code <= 0x1733) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       HANUNOO SIGN PAMUDPOD
                        if (0x1734 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x1772) {
                        // Mn   [2] BUHID VOWEL SIGN I..BUHID VOWEL SIGN U
                        if (0x1752 <= code && code <= 0x1753) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x17b4) {
                          // Mn   [2] TAGBANWA VOWEL SIGN I..TAGBANWA VOWEL SIGN U
                          if (0x1772 <= code && code <= 0x1773) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] KHMER VOWEL INHERENT AQ..KHMER VOWEL INHERENT AA
                          if (0x17b4 <= code && code <= 0x17b5) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x17be) {
                      if (code < 0x17b7) {
                        // Mc       KHMER VOWEL SIGN AA
                        if (0x17b6 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [7] KHMER VOWEL SIGN I..KHMER VOWEL SIGN UA
                        if (0x17b7 <= code && code <= 0x17bd) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x17c6) {
                        // Mc   [8] KHMER VOWEL SIGN OE..KHMER VOWEL SIGN AU
                        if (0x17be <= code && code <= 0x17c5) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x17c7) {
                          // Mn       KHMER SIGN NIKAHIT
                          if (0x17c6 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] KHMER SIGN REAHMUK..KHMER SIGN YUUKALEAPINTU
                          if (0x17c7 <= code && code <= 0x17c8) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x1885) {
                    if (code < 0x180b) {
                      if (code < 0x17dd) {
                        // Mn  [11] KHMER SIGN MUUSIKATOAN..KHMER SIGN BATHAMASAT
                        if (0x17c9 <= code && code <= 0x17d3) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       KHMER SIGN ATTHACAN
                        if (0x17dd === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x180e) {
                        // Mn   [3] MONGOLIAN FREE VARIATION SELECTOR ONE..MONGOLIAN FREE VARIATION SELECTOR THREE
                        if (0x180b <= code && code <= 0x180d) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Cf       MONGOLIAN VOWEL SEPARATOR
                        if (0x180e === code) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                        // Mn       MONGOLIAN FREE VARIATION SELECTOR FOUR
                        if (0x180f === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0x1923) {
                      if (code < 0x18a9) {
                        // Mn   [2] MONGOLIAN LETTER ALI GALI BALUDA..MONGOLIAN LETTER ALI GALI THREE BALUDA
                        if (0x1885 <= code && code <= 0x1886) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1920) {
                          // Mn       MONGOLIAN LETTER ALI GALI DAGALGA
                          if (0x18a9 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [3] LIMBU VOWEL SIGN A..LIMBU VOWEL SIGN U
                          if (0x1920 <= code && code <= 0x1922) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1927) {
                        // Mc   [4] LIMBU VOWEL SIGN EE..LIMBU VOWEL SIGN AU
                        if (0x1923 <= code && code <= 0x1926) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x1929) {
                          // Mn   [2] LIMBU VOWEL SIGN E..LIMBU VOWEL SIGN O
                          if (0x1927 <= code && code <= 0x1928) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [3] LIMBU SUBJOINED LETTER YA..LIMBU SUBJOINED LETTER WA
                          if (0x1929 <= code && code <= 0x192b) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0x1b3b) {
                if (code < 0x1a58) {
                  if (code < 0x1a19) {
                    if (code < 0x1933) {
                      if (code < 0x1932) {
                        // Mc   [2] LIMBU SMALL LETTER KA..LIMBU SMALL LETTER NGA
                        if (0x1930 <= code && code <= 0x1931) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       LIMBU SMALL LETTER ANUSVARA
                        if (0x1932 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x1939) {
                        // Mc   [6] LIMBU SMALL LETTER TA..LIMBU SMALL LETTER LA
                        if (0x1933 <= code && code <= 0x1938) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x1a17) {
                          // Mn   [3] LIMBU SIGN MUKPHRENG..LIMBU SIGN SA-I
                          if (0x1939 <= code && code <= 0x193b) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] BUGINESE VOWEL SIGN I..BUGINESE VOWEL SIGN U
                          if (0x1a17 <= code && code <= 0x1a18) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1a55) {
                      if (code < 0x1a1b) {
                        // Mc   [2] BUGINESE VOWEL SIGN E..BUGINESE VOWEL SIGN O
                        if (0x1a19 <= code && code <= 0x1a1a) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       BUGINESE VOWEL SIGN AE
                        if (0x1a1b === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x1a56) {
                        // Mc       TAI THAM CONSONANT SIGN MEDIAL RA
                        if (0x1a55 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       TAI THAM CONSONANT SIGN MEDIAL LA
                        if (0x1a56 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mc       TAI THAM CONSONANT SIGN LA TANG LAI
                        if (0x1a57 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x1a73) {
                    if (code < 0x1a62) {
                      if (code < 0x1a60) {
                        // Mn   [7] TAI THAM SIGN MAI KANG LAI..TAI THAM CONSONANT SIGN SA
                        if (0x1a58 <= code && code <= 0x1a5e) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       TAI THAM SIGN SAKOT
                        if (0x1a60 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x1a65) {
                        // Mn       TAI THAM VOWEL SIGN MAI SAT
                        if (0x1a62 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1a6d) {
                          // Mn   [8] TAI THAM VOWEL SIGN I..TAI THAM VOWEL SIGN OA BELOW
                          if (0x1a65 <= code && code <= 0x1a6c) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [6] TAI THAM VOWEL SIGN OY..TAI THAM VOWEL SIGN THAM AI
                          if (0x1a6d <= code && code <= 0x1a72) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1b00) {
                      if (code < 0x1a7f) {
                        // Mn  [10] TAI THAM VOWEL SIGN OA ABOVE..TAI THAM SIGN KHUEN-LUE KARAN
                        if (0x1a73 <= code && code <= 0x1a7c) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1ab0) {
                          // Mn       TAI THAM COMBINING CRYPTOGRAMMIC DOT
                          if (0x1a7f === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn  [14] COMBINING DOUBLED CIRCUMFLEX ACCENT..COMBINING PARENTHESES BELOW
                          // Me       COMBINING PARENTHESES OVERLAY
                          // Mn  [16] COMBINING LATIN SMALL LETTER W BELOW..COMBINING LATIN SMALL LETTER INSULAR T
                          if (0x1ab0 <= code && code <= 0x1ace) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1b04) {
                        // Mn   [4] BALINESE SIGN ULU RICEM..BALINESE SIGN SURANG
                        if (0x1b00 <= code && code <= 0x1b03) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1b34) {
                          // Mc       BALINESE SIGN BISAH
                          if (0x1b04 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       BALINESE SIGN REREKAN
                          // Mc       BALINESE VOWEL SIGN TEDUNG
                          // Mn   [5] BALINESE VOWEL SIGN ULU..BALINESE VOWEL SIGN RA REPA
                          if (0x1b34 <= code && code <= 0x1b3a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x1ba8) {
                  if (code < 0x1b6b) {
                    if (code < 0x1b3d) {
                      // Mc       BALINESE VOWEL SIGN RA REPA TEDUNG
                      if (0x1b3b === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                      // Mn       BALINESE VOWEL SIGN LA LENGA
                      if (0x1b3c === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0x1b42) {
                        // Mc   [5] BALINESE VOWEL SIGN LA LENGA TEDUNG..BALINESE VOWEL SIGN TALING REPA TEDUNG
                        if (0x1b3d <= code && code <= 0x1b41) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x1b43) {
                          // Mn       BALINESE VOWEL SIGN PEPET
                          if (0x1b42 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] BALINESE VOWEL SIGN PEPET TEDUNG..BALINESE ADEG ADEG
                          if (0x1b43 <= code && code <= 0x1b44) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1ba1) {
                      if (code < 0x1b80) {
                        // Mn   [9] BALINESE MUSICAL SYMBOL COMBINING TEGEH..BALINESE MUSICAL SYMBOL COMBINING GONG
                        if (0x1b6b <= code && code <= 0x1b73) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1b82) {
                          // Mn   [2] SUNDANESE SIGN PANYECEK..SUNDANESE SIGN PANGLAYAR
                          if (0x1b80 <= code && code <= 0x1b81) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc       SUNDANESE SIGN PANGWISAD
                          if (0x1b82 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1ba2) {
                        // Mc       SUNDANESE CONSONANT SIGN PAMINGKAL
                        if (0x1ba1 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x1ba6) {
                          // Mn   [4] SUNDANESE CONSONANT SIGN PANYAKRA..SUNDANESE VOWEL SIGN PANYUKU
                          if (0x1ba2 <= code && code <= 0x1ba5) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] SUNDANESE VOWEL SIGN PANAELAENG..SUNDANESE VOWEL SIGN PANOLONG
                          if (0x1ba6 <= code && code <= 0x1ba7) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x1be8) {
                    if (code < 0x1bab) {
                      if (code < 0x1baa) {
                        // Mn   [2] SUNDANESE VOWEL SIGN PAMEPET..SUNDANESE VOWEL SIGN PANEULEUNG
                        if (0x1ba8 <= code && code <= 0x1ba9) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       SUNDANESE SIGN PAMAAEH
                        if (0x1baa === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x1be6) {
                        // Mn   [3] SUNDANESE SIGN VIRAMA..SUNDANESE CONSONANT SIGN PASANGAN WA
                        if (0x1bab <= code && code <= 0x1bad) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       BATAK SIGN TOMPI
                        if (0x1be6 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mc       BATAK VOWEL SIGN E
                        if (0x1be7 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    }
                  } else {
                    if (code < 0x1bee) {
                      if (code < 0x1bea) {
                        // Mn   [2] BATAK VOWEL SIGN PAKPAK E..BATAK VOWEL SIGN EE
                        if (0x1be8 <= code && code <= 0x1be9) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1bed) {
                          // Mc   [3] BATAK VOWEL SIGN I..BATAK VOWEL SIGN O
                          if (0x1bea <= code && code <= 0x1bec) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       BATAK VOWEL SIGN KARO O
                          if (0x1bed === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1bef) {
                        // Mc       BATAK VOWEL SIGN U
                        if (0x1bee === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x1bf2) {
                          // Mn   [3] BATAK VOWEL SIGN U FOR SIMALUNGUN SA..BATAK CONSONANT SIGN H
                          if (0x1bef <= code && code <= 0x1bf1) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] BATAK PANGOLAT..BATAK PANONGONAN
                          if (0x1bf2 <= code && code <= 0x1bf3) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 0xa952) {
              if (code < 0x2d7f) {
                if (code < 0x1cf7) {
                  if (code < 0x1cd4) {
                    if (code < 0x1c34) {
                      if (code < 0x1c2c) {
                        // Mc   [8] LEPCHA SUBJOINED LETTER YA..LEPCHA VOWEL SIGN UU
                        if (0x1c24 <= code && code <= 0x1c2b) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [8] LEPCHA VOWEL SIGN E..LEPCHA CONSONANT SIGN T
                        if (0x1c2c <= code && code <= 0x1c33) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x1c36) {
                        // Mc   [2] LEPCHA CONSONANT SIGN NYIN-DO..LEPCHA CONSONANT SIGN KANG
                        if (0x1c34 <= code && code <= 0x1c35) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x1cd0) {
                          // Mn   [2] LEPCHA SIGN RAN..LEPCHA SIGN NUKTA
                          if (0x1c36 <= code && code <= 0x1c37) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [3] VEDIC TONE KARSHANA..VEDIC TONE PRENKHA
                          if (0x1cd0 <= code && code <= 0x1cd2) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1ce2) {
                      if (code < 0x1ce1) {
                        // Mn  [13] VEDIC SIGN YAJURVEDIC MIDLINE SVARITA..VEDIC TONE RIGVEDIC KASHMIRI INDEPENDENT SVARITA
                        if (0x1cd4 <= code && code <= 0x1ce0) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       VEDIC TONE ATHARVAVEDIC INDEPENDENT SVARITA
                        if (0x1ce1 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x1ced) {
                        // Mn   [7] VEDIC SIGN VISARGA SVARITA..VEDIC SIGN VISARGA ANUDATTA WITH TAIL
                        if (0x1ce2 <= code && code <= 0x1ce8) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       VEDIC SIGN TIRYAK
                        if (0x1ced === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mn       VEDIC TONE CANDRA ABOVE
                        if (0x1cf4 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x200d) {
                    if (code < 0x1dc0) {
                      if (code < 0x1cf8) {
                        // Mc       VEDIC SIGN ATIKRAMA
                        if (0x1cf7 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [2] VEDIC TONE RING ABOVE..VEDIC TONE DOUBLE RING ABOVE
                        if (0x1cf8 <= code && code <= 0x1cf9) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x200b) {
                        // Mn  [64] COMBINING DOTTED GRAVE ACCENT..COMBINING RIGHT ARROWHEAD AND DOWN ARROWHEAD BELOW
                        if (0x1dc0 <= code && code <= 0x1dff) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Cf       ZERO WIDTH SPACE
                        if (0x200b === code) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                        // Cf       ZERO WIDTH NON-JOINER
                        if (0x200c === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0x2060) {
                      if (code < 0x200e) {
                        // Cf       ZERO WIDTH JOINER
                        if (0x200d === code) {
                          return boundaries_1.CLUSTER_BREAK.ZWJ;
                        }
                      } else {
                        if (code < 0x2028) {
                          // Cf   [2] LEFT-TO-RIGHT MARK..RIGHT-TO-LEFT MARK
                          if (0x200e <= code && code <= 0x200f) {
                            return boundaries_1.CLUSTER_BREAK.CONTROL;
                          }
                        } else {
                          // Zl       LINE SEPARATOR
                          // Zp       PARAGRAPH SEPARATOR
                          // Cf   [5] LEFT-TO-RIGHT EMBEDDING..RIGHT-TO-LEFT OVERRIDE
                          if (0x2028 <= code && code <= 0x202e) {
                            return boundaries_1.CLUSTER_BREAK.CONTROL;
                          }
                        }
                      }
                    } else {
                      if (code < 0x20d0) {
                        // Cf   [5] WORD JOINER..INVISIBLE PLUS
                        // Cn       <reserved-2065>
                        // Cf  [10] LEFT-TO-RIGHT ISOLATE..NOMINAL DIGIT SHAPES
                        if (0x2060 <= code && code <= 0x206f) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      } else {
                        if (code < 0x2cef) {
                          // Mn  [13] COMBINING LEFT HARPOON ABOVE..COMBINING FOUR DOTS ABOVE
                          // Me   [4] COMBINING ENCLOSING CIRCLE..COMBINING ENCLOSING CIRCLE BACKSLASH
                          // Mn       COMBINING LEFT RIGHT ARROW ABOVE
                          // Me   [3] COMBINING ENCLOSING SCREEN..COMBINING ENCLOSING UPWARD POINTING TRIANGLE
                          // Mn  [12] COMBINING REVERSE SOLIDUS OVERLAY..COMBINING ASTERISK ABOVE
                          if (0x20d0 <= code && code <= 0x20f0) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [3] COPTIC COMBINING NI ABOVE..COPTIC COMBINING SPIRITUS LENIS
                          if (0x2cef <= code && code <= 0x2cf1) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xa823) {
                  if (code < 0xa674) {
                    if (code < 0x302a) {
                      if (code < 0x2de0) {
                        // Mn       TIFINAGH CONSONANT JOINER
                        if (0x2d7f === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn  [32] COMBINING CYRILLIC LETTER BE..COMBINING CYRILLIC LETTER IOTIFIED BIG YUS
                        if (0x2de0 <= code && code <= 0x2dff) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x3099) {
                        // Mn   [4] IDEOGRAPHIC LEVEL TONE MARK..IDEOGRAPHIC ENTERING TONE MARK
                        // Mc   [2] HANGUL SINGLE DOT TONE MARK..HANGUL DOUBLE DOT TONE MARK
                        if (0x302a <= code && code <= 0x302f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xa66f) {
                          // Mn   [2] COMBINING KATAKANA-HIRAGANA VOICED SOUND MARK..COMBINING KATAKANA-HIRAGANA SEMI-VOICED SOUND MARK
                          if (0x3099 <= code && code <= 0x309a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       COMBINING CYRILLIC VZMET
                          // Me   [3] COMBINING CYRILLIC TEN MILLIONS SIGN..COMBINING CYRILLIC THOUSAND MILLIONS SIGN
                          if (0xa66f <= code && code <= 0xa672) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xa802) {
                      if (code < 0xa69e) {
                        // Mn  [10] COMBINING CYRILLIC LETTER UKRAINIAN IE..COMBINING CYRILLIC PAYEROK
                        if (0xa674 <= code && code <= 0xa67d) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xa6f0) {
                          // Mn   [2] COMBINING CYRILLIC LETTER EF..COMBINING CYRILLIC LETTER IOTIFIED E
                          if (0xa69e <= code && code <= 0xa69f) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] BAMUM COMBINING MARK KOQNDON..BAMUM COMBINING MARK TUKWENTIS
                          if (0xa6f0 <= code && code <= 0xa6f1) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0xa806) {
                        // Mn       SYLOTI NAGRI SIGN DVISVARA
                        if (0xa802 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       SYLOTI NAGRI SIGN HASANTA
                        if (0xa806 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mn       SYLOTI NAGRI SIGN ANUSVARA
                        if (0xa80b === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xa8b4) {
                    if (code < 0xa827) {
                      if (code < 0xa825) {
                        // Mc   [2] SYLOTI NAGRI VOWEL SIGN A..SYLOTI NAGRI VOWEL SIGN I
                        if (0xa823 <= code && code <= 0xa824) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [2] SYLOTI NAGRI VOWEL SIGN U..SYLOTI NAGRI VOWEL SIGN E
                        if (0xa825 <= code && code <= 0xa826) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xa82c) {
                        // Mc       SYLOTI NAGRI VOWEL SIGN OO
                        if (0xa827 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xa880) {
                          // Mn       SYLOTI NAGRI SIGN ALTERNATE HASANTA
                          if (0xa82c === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] SAURASHTRA SIGN ANUSVARA..SAURASHTRA SIGN VISARGA
                          if (0xa880 <= code && code <= 0xa881) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xa8ff) {
                      if (code < 0xa8c4) {
                        // Mc  [16] SAURASHTRA CONSONANT SIGN HAARU..SAURASHTRA VOWEL SIGN AU
                        if (0xa8b4 <= code && code <= 0xa8c3) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xa8e0) {
                          // Mn   [2] SAURASHTRA SIGN VIRAMA..SAURASHTRA SIGN CANDRABINDU
                          if (0xa8c4 <= code && code <= 0xa8c5) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn  [18] COMBINING DEVANAGARI DIGIT ZERO..COMBINING DEVANAGARI SIGN AVAGRAHA
                          if (0xa8e0 <= code && code <= 0xa8f1) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0xa926) {
                        // Mn       DEVANAGARI VOWEL SIGN AY
                        if (0xa8ff === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xa947) {
                          // Mn   [8] KAYAH LI VOWEL UE..KAYAH LI TONE CALYA PLOPHU
                          if (0xa926 <= code && code <= 0xa92d) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn  [11] REJANG VOWEL SIGN I..REJANG CONSONANT SIGN R
                          if (0xa947 <= code && code <= 0xa951) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xaab2) {
                if (code < 0xa9e5) {
                  if (code < 0xa9b4) {
                    if (code < 0xa980) {
                      if (code < 0xa960) {
                        // Mc   [2] REJANG CONSONANT SIGN H..REJANG VIRAMA
                        if (0xa952 <= code && code <= 0xa953) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Lo  [29] HANGUL CHOSEONG TIKEUT-MIEUM..HANGUL CHOSEONG SSANGYEORINHIEUH
                        if (0xa960 <= code && code <= 0xa97c) {
                          return boundaries_1.CLUSTER_BREAK.L;
                        }
                      }
                    } else {
                      if (code < 0xa983) {
                        // Mn   [3] JAVANESE SIGN PANYANGGA..JAVANESE SIGN LAYAR
                        if (0xa980 <= code && code <= 0xa982) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       JAVANESE SIGN WIGNYAN
                        if (0xa983 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                        // Mn       JAVANESE SIGN CECAK TELU
                        if (0xa9b3 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0xa9ba) {
                      if (code < 0xa9b6) {
                        // Mc   [2] JAVANESE VOWEL SIGN TARUNG..JAVANESE VOWEL SIGN TOLONG
                        if (0xa9b4 <= code && code <= 0xa9b5) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [4] JAVANESE VOWEL SIGN WULU..JAVANESE VOWEL SIGN SUKU MENDUT
                        if (0xa9b6 <= code && code <= 0xa9b9) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xa9bc) {
                        // Mc   [2] JAVANESE VOWEL SIGN TALING..JAVANESE VOWEL SIGN DIRGA MURE
                        if (0xa9ba <= code && code <= 0xa9bb) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xa9be) {
                          // Mn   [2] JAVANESE VOWEL SIGN PEPET..JAVANESE CONSONANT SIGN KERET
                          if (0xa9bc <= code && code <= 0xa9bd) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [3] JAVANESE CONSONANT SIGN PENGKAL..JAVANESE PANGKON
                          if (0xa9be <= code && code <= 0xa9c0) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xaa35) {
                    if (code < 0xaa2f) {
                      if (code < 0xaa29) {
                        // Mn       MYANMAR SIGN SHAN SAW
                        if (0xa9e5 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [6] CHAM VOWEL SIGN AA..CHAM VOWEL SIGN OE
                        if (0xaa29 <= code && code <= 0xaa2e) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xaa31) {
                        // Mc   [2] CHAM VOWEL SIGN O..CHAM VOWEL SIGN AI
                        if (0xaa2f <= code && code <= 0xaa30) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0xaa33) {
                          // Mn   [2] CHAM VOWEL SIGN AU..CHAM VOWEL SIGN UE
                          if (0xaa31 <= code && code <= 0xaa32) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] CHAM CONSONANT SIGN YA..CHAM CONSONANT SIGN RA
                          if (0xaa33 <= code && code <= 0xaa34) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xaa4d) {
                      if (code < 0xaa43) {
                        // Mn   [2] CHAM CONSONANT SIGN LA..CHAM CONSONANT SIGN WA
                        if (0xaa35 <= code && code <= 0xaa36) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       CHAM CONSONANT SIGN FINAL NG
                        if (0xaa43 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mn       CHAM CONSONANT SIGN FINAL M
                        if (0xaa4c === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xaa7c) {
                        // Mc       CHAM CONSONANT SIGN FINAL H
                        if (0xaa4d === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       MYANMAR SIGN TAI LAING TONE-2
                        if (0xaa7c === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mn       TAI VIET MAI KANG
                        if (0xaab0 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xabe6) {
                  if (code < 0xaaec) {
                    if (code < 0xaabe) {
                      if (code < 0xaab7) {
                        // Mn   [3] TAI VIET VOWEL I..TAI VIET VOWEL U
                        if (0xaab2 <= code && code <= 0xaab4) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [2] TAI VIET MAI KHIT..TAI VIET VOWEL IA
                        if (0xaab7 <= code && code <= 0xaab8) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xaac1) {
                        // Mn   [2] TAI VIET VOWEL AM..TAI VIET TONE MAI EK
                        if (0xaabe <= code && code <= 0xaabf) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn       TAI VIET TONE MAI THO
                        if (0xaac1 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mc       MEETEI MAYEK VOWEL SIGN II
                        if (0xaaeb === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    }
                  } else {
                    if (code < 0xaaf6) {
                      if (code < 0xaaee) {
                        // Mn   [2] MEETEI MAYEK VOWEL SIGN UU..MEETEI MAYEK VOWEL SIGN AAI
                        if (0xaaec <= code && code <= 0xaaed) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xaaf5) {
                          // Mc   [2] MEETEI MAYEK VOWEL SIGN AU..MEETEI MAYEK VOWEL SIGN AAU
                          if (0xaaee <= code && code <= 0xaaef) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mc       MEETEI MAYEK VOWEL SIGN VISARGA
                          if (0xaaf5 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0xabe3) {
                        // Mn       MEETEI MAYEK VIRAMA
                        if (0xaaf6 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xabe5) {
                          // Mc   [2] MEETEI MAYEK VOWEL SIGN ONAP..MEETEI MAYEK VOWEL SIGN INAP
                          if (0xabe3 <= code && code <= 0xabe4) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       MEETEI MAYEK VOWEL SIGN ANAP
                          if (0xabe5 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xac00) {
                    if (code < 0xabe9) {
                      if (code < 0xabe8) {
                        // Mc   [2] MEETEI MAYEK VOWEL SIGN YENAP..MEETEI MAYEK VOWEL SIGN SOUNAP
                        if (0xabe6 <= code && code <= 0xabe7) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       MEETEI MAYEK VOWEL SIGN UNAP
                        if (0xabe8 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0xabec) {
                        // Mc   [2] MEETEI MAYEK VOWEL SIGN CHEINAP..MEETEI MAYEK VOWEL SIGN NUNG
                        if (0xabe9 <= code && code <= 0xabea) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mc       MEETEI MAYEK LUM IYEK
                        if (0xabec === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                        // Mn       MEETEI MAYEK APUN IYEK
                        if (0xabed === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0xac1d) {
                      if (code < 0xac01) {
                        // Lo       HANGUL SYLLABLE GA
                        if (0xac00 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xac1c) {
                          // Lo  [27] HANGUL SYLLABLE GAG..HANGUL SYLLABLE GAH
                          if (0xac01 <= code && code <= 0xac1b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GAE
                          if (0xac1c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xac38) {
                        // Lo  [27] HANGUL SYLLABLE GAEG..HANGUL SYLLABLE GAEH
                        if (0xac1d <= code && code <= 0xac37) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xac39) {
                          // Lo       HANGUL SYLLABLE GYA
                          if (0xac38 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GYAG..HANGUL SYLLABLE GYAH
                          if (0xac39 <= code && code <= 0xac53) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        if (code < 0xb5a1) {
          if (code < 0xb0ed) {
            if (code < 0xaea0) {
              if (code < 0xad6d) {
                if (code < 0xace0) {
                  if (code < 0xac8d) {
                    if (code < 0xac70) {
                      if (code < 0xac55) {
                        // Lo       HANGUL SYLLABLE GYAE
                        if (0xac54 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE GYAEG..HANGUL SYLLABLE GYAEH
                        if (0xac55 <= code && code <= 0xac6f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xac71) {
                        // Lo       HANGUL SYLLABLE GEO
                        if (0xac70 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xac8c) {
                          // Lo  [27] HANGUL SYLLABLE GEOG..HANGUL SYLLABLE GEOH
                          if (0xac71 <= code && code <= 0xac8b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GE
                          if (0xac8c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xaca9) {
                      if (code < 0xaca8) {
                        // Lo  [27] HANGUL SYLLABLE GEG..HANGUL SYLLABLE GEH
                        if (0xac8d <= code && code <= 0xaca7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE GYEO
                        if (0xaca8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xacc4) {
                        // Lo  [27] HANGUL SYLLABLE GYEOG..HANGUL SYLLABLE GYEOH
                        if (0xaca9 <= code && code <= 0xacc3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xacc5) {
                          // Lo       HANGUL SYLLABLE GYE
                          if (0xacc4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GYEG..HANGUL SYLLABLE GYEH
                          if (0xacc5 <= code && code <= 0xacdf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xad19) {
                    if (code < 0xacfc) {
                      if (code < 0xace1) {
                        // Lo       HANGUL SYLLABLE GO
                        if (0xace0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE GOG..HANGUL SYLLABLE GOH
                        if (0xace1 <= code && code <= 0xacfb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xacfd) {
                        // Lo       HANGUL SYLLABLE GWA
                        if (0xacfc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xad18) {
                          // Lo  [27] HANGUL SYLLABLE GWAG..HANGUL SYLLABLE GWAH
                          if (0xacfd <= code && code <= 0xad17) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GWAE
                          if (0xad18 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xad50) {
                      if (code < 0xad34) {
                        // Lo  [27] HANGUL SYLLABLE GWAEG..HANGUL SYLLABLE GWAEH
                        if (0xad19 <= code && code <= 0xad33) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xad35) {
                          // Lo       HANGUL SYLLABLE GOE
                          if (0xad34 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GOEG..HANGUL SYLLABLE GOEH
                          if (0xad35 <= code && code <= 0xad4f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xad51) {
                        // Lo       HANGUL SYLLABLE GYO
                        if (0xad50 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xad6c) {
                          // Lo  [27] HANGUL SYLLABLE GYOG..HANGUL SYLLABLE GYOH
                          if (0xad51 <= code && code <= 0xad6b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GU
                          if (0xad6c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xadf9) {
                  if (code < 0xadc0) {
                    if (code < 0xad89) {
                      if (code < 0xad88) {
                        // Lo  [27] HANGUL SYLLABLE GUG..HANGUL SYLLABLE GUH
                        if (0xad6d <= code && code <= 0xad87) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE GWEO
                        if (0xad88 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xada4) {
                        // Lo  [27] HANGUL SYLLABLE GWEOG..HANGUL SYLLABLE GWEOH
                        if (0xad89 <= code && code <= 0xada3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xada5) {
                          // Lo       HANGUL SYLLABLE GWE
                          if (0xada4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GWEG..HANGUL SYLLABLE GWEH
                          if (0xada5 <= code && code <= 0xadbf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xaddc) {
                      if (code < 0xadc1) {
                        // Lo       HANGUL SYLLABLE GWI
                        if (0xadc0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE GWIG..HANGUL SYLLABLE GWIH
                        if (0xadc1 <= code && code <= 0xaddb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xaddd) {
                        // Lo       HANGUL SYLLABLE GYU
                        if (0xaddc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xadf8) {
                          // Lo  [27] HANGUL SYLLABLE GYUG..HANGUL SYLLABLE GYUH
                          if (0xaddd <= code && code <= 0xadf7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GEU
                          if (0xadf8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xae4c) {
                    if (code < 0xae15) {
                      if (code < 0xae14) {
                        // Lo  [27] HANGUL SYLLABLE GEUG..HANGUL SYLLABLE GEUH
                        if (0xadf9 <= code && code <= 0xae13) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE GYI
                        if (0xae14 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xae30) {
                        // Lo  [27] HANGUL SYLLABLE GYIG..HANGUL SYLLABLE GYIH
                        if (0xae15 <= code && code <= 0xae2f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xae31) {
                          // Lo       HANGUL SYLLABLE GI
                          if (0xae30 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GIG..HANGUL SYLLABLE GIH
                          if (0xae31 <= code && code <= 0xae4b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xae69) {
                      if (code < 0xae4d) {
                        // Lo       HANGUL SYLLABLE GGA
                        if (0xae4c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xae68) {
                          // Lo  [27] HANGUL SYLLABLE GGAG..HANGUL SYLLABLE GGAH
                          if (0xae4d <= code && code <= 0xae67) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GGAE
                          if (0xae68 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xae84) {
                        // Lo  [27] HANGUL SYLLABLE GGAEG..HANGUL SYLLABLE GGAEH
                        if (0xae69 <= code && code <= 0xae83) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xae85) {
                          // Lo       HANGUL SYLLABLE GGYA
                          if (0xae84 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GGYAG..HANGUL SYLLABLE GGYAH
                          if (0xae85 <= code && code <= 0xae9f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xafb9) {
                if (code < 0xaf2c) {
                  if (code < 0xaed9) {
                    if (code < 0xaebc) {
                      if (code < 0xaea1) {
                        // Lo       HANGUL SYLLABLE GGYAE
                        if (0xaea0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE GGYAEG..HANGUL SYLLABLE GGYAEH
                        if (0xaea1 <= code && code <= 0xaebb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xaebd) {
                        // Lo       HANGUL SYLLABLE GGEO
                        if (0xaebc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xaed8) {
                          // Lo  [27] HANGUL SYLLABLE GGEOG..HANGUL SYLLABLE GGEOH
                          if (0xaebd <= code && code <= 0xaed7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GGE
                          if (0xaed8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xaef5) {
                      if (code < 0xaef4) {
                        // Lo  [27] HANGUL SYLLABLE GGEG..HANGUL SYLLABLE GGEH
                        if (0xaed9 <= code && code <= 0xaef3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE GGYEO
                        if (0xaef4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xaf10) {
                        // Lo  [27] HANGUL SYLLABLE GGYEOG..HANGUL SYLLABLE GGYEOH
                        if (0xaef5 <= code && code <= 0xaf0f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xaf11) {
                          // Lo       HANGUL SYLLABLE GGYE
                          if (0xaf10 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GGYEG..HANGUL SYLLABLE GGYEH
                          if (0xaf11 <= code && code <= 0xaf2b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xaf65) {
                    if (code < 0xaf48) {
                      if (code < 0xaf2d) {
                        // Lo       HANGUL SYLLABLE GGO
                        if (0xaf2c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE GGOG..HANGUL SYLLABLE GGOH
                        if (0xaf2d <= code && code <= 0xaf47) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xaf49) {
                        // Lo       HANGUL SYLLABLE GGWA
                        if (0xaf48 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xaf64) {
                          // Lo  [27] HANGUL SYLLABLE GGWAG..HANGUL SYLLABLE GGWAH
                          if (0xaf49 <= code && code <= 0xaf63) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GGWAE
                          if (0xaf64 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xaf9c) {
                      if (code < 0xaf80) {
                        // Lo  [27] HANGUL SYLLABLE GGWAEG..HANGUL SYLLABLE GGWAEH
                        if (0xaf65 <= code && code <= 0xaf7f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xaf81) {
                          // Lo       HANGUL SYLLABLE GGOE
                          if (0xaf80 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GGOEG..HANGUL SYLLABLE GGOEH
                          if (0xaf81 <= code && code <= 0xaf9b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xaf9d) {
                        // Lo       HANGUL SYLLABLE GGYO
                        if (0xaf9c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xafb8) {
                          // Lo  [27] HANGUL SYLLABLE GGYOG..HANGUL SYLLABLE GGYOH
                          if (0xaf9d <= code && code <= 0xafb7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GGU
                          if (0xafb8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xb060) {
                  if (code < 0xb00c) {
                    if (code < 0xafd5) {
                      if (code < 0xafd4) {
                        // Lo  [27] HANGUL SYLLABLE GGUG..HANGUL SYLLABLE GGUH
                        if (0xafb9 <= code && code <= 0xafd3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE GGWEO
                        if (0xafd4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xaff0) {
                        // Lo  [27] HANGUL SYLLABLE GGWEOG..HANGUL SYLLABLE GGWEOH
                        if (0xafd5 <= code && code <= 0xafef) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xaff1) {
                          // Lo       HANGUL SYLLABLE GGWE
                          if (0xaff0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GGWEG..HANGUL SYLLABLE GGWEH
                          if (0xaff1 <= code && code <= 0xb00b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb029) {
                      if (code < 0xb00d) {
                        // Lo       HANGUL SYLLABLE GGWI
                        if (0xb00c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb028) {
                          // Lo  [27] HANGUL SYLLABLE GGWIG..HANGUL SYLLABLE GGWIH
                          if (0xb00d <= code && code <= 0xb027) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE GGYU
                          if (0xb028 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb044) {
                        // Lo  [27] HANGUL SYLLABLE GGYUG..HANGUL SYLLABLE GGYUH
                        if (0xb029 <= code && code <= 0xb043) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb045) {
                          // Lo       HANGUL SYLLABLE GGEU
                          if (0xb044 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE GGEUG..HANGUL SYLLABLE GGEUH
                          if (0xb045 <= code && code <= 0xb05f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xb099) {
                    if (code < 0xb07c) {
                      if (code < 0xb061) {
                        // Lo       HANGUL SYLLABLE GGYI
                        if (0xb060 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE GGYIG..HANGUL SYLLABLE GGYIH
                        if (0xb061 <= code && code <= 0xb07b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb07d) {
                        // Lo       HANGUL SYLLABLE GGI
                        if (0xb07c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb098) {
                          // Lo  [27] HANGUL SYLLABLE GGIG..HANGUL SYLLABLE GGIH
                          if (0xb07d <= code && code <= 0xb097) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE NA
                          if (0xb098 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb0d0) {
                      if (code < 0xb0b4) {
                        // Lo  [27] HANGUL SYLLABLE NAG..HANGUL SYLLABLE NAH
                        if (0xb099 <= code && code <= 0xb0b3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb0b5) {
                          // Lo       HANGUL SYLLABLE NAE
                          if (0xb0b4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE NAEG..HANGUL SYLLABLE NAEH
                          if (0xb0b5 <= code && code <= 0xb0cf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb0d1) {
                        // Lo       HANGUL SYLLABLE NYA
                        if (0xb0d0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb0ec) {
                          // Lo  [27] HANGUL SYLLABLE NYAG..HANGUL SYLLABLE NYAH
                          if (0xb0d1 <= code && code <= 0xb0eb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE NYAE
                          if (0xb0ec === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 0xb354) {
              if (code < 0xb220) {
                if (code < 0xb179) {
                  if (code < 0xb140) {
                    if (code < 0xb109) {
                      if (code < 0xb108) {
                        // Lo  [27] HANGUL SYLLABLE NYAEG..HANGUL SYLLABLE NYAEH
                        if (0xb0ed <= code && code <= 0xb107) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE NEO
                        if (0xb108 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb124) {
                        // Lo  [27] HANGUL SYLLABLE NEOG..HANGUL SYLLABLE NEOH
                        if (0xb109 <= code && code <= 0xb123) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb125) {
                          // Lo       HANGUL SYLLABLE NE
                          if (0xb124 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE NEG..HANGUL SYLLABLE NEH
                          if (0xb125 <= code && code <= 0xb13f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb15c) {
                      if (code < 0xb141) {
                        // Lo       HANGUL SYLLABLE NYEO
                        if (0xb140 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE NYEOG..HANGUL SYLLABLE NYEOH
                        if (0xb141 <= code && code <= 0xb15b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb15d) {
                        // Lo       HANGUL SYLLABLE NYE
                        if (0xb15c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb178) {
                          // Lo  [27] HANGUL SYLLABLE NYEG..HANGUL SYLLABLE NYEH
                          if (0xb15d <= code && code <= 0xb177) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE NO
                          if (0xb178 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xb1cc) {
                    if (code < 0xb195) {
                      if (code < 0xb194) {
                        // Lo  [27] HANGUL SYLLABLE NOG..HANGUL SYLLABLE NOH
                        if (0xb179 <= code && code <= 0xb193) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE NWA
                        if (0xb194 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb1b0) {
                        // Lo  [27] HANGUL SYLLABLE NWAG..HANGUL SYLLABLE NWAH
                        if (0xb195 <= code && code <= 0xb1af) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb1b1) {
                          // Lo       HANGUL SYLLABLE NWAE
                          if (0xb1b0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE NWAEG..HANGUL SYLLABLE NWAEH
                          if (0xb1b1 <= code && code <= 0xb1cb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb1e9) {
                      if (code < 0xb1cd) {
                        // Lo       HANGUL SYLLABLE NOE
                        if (0xb1cc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb1e8) {
                          // Lo  [27] HANGUL SYLLABLE NOEG..HANGUL SYLLABLE NOEH
                          if (0xb1cd <= code && code <= 0xb1e7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE NYO
                          if (0xb1e8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb204) {
                        // Lo  [27] HANGUL SYLLABLE NYOG..HANGUL SYLLABLE NYOH
                        if (0xb1e9 <= code && code <= 0xb203) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb205) {
                          // Lo       HANGUL SYLLABLE NU
                          if (0xb204 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE NUG..HANGUL SYLLABLE NUH
                          if (0xb205 <= code && code <= 0xb21f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xb2ad) {
                  if (code < 0xb259) {
                    if (code < 0xb23c) {
                      if (code < 0xb221) {
                        // Lo       HANGUL SYLLABLE NWEO
                        if (0xb220 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE NWEOG..HANGUL SYLLABLE NWEOH
                        if (0xb221 <= code && code <= 0xb23b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb23d) {
                        // Lo       HANGUL SYLLABLE NWE
                        if (0xb23c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb258) {
                          // Lo  [27] HANGUL SYLLABLE NWEG..HANGUL SYLLABLE NWEH
                          if (0xb23d <= code && code <= 0xb257) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE NWI
                          if (0xb258 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb290) {
                      if (code < 0xb274) {
                        // Lo  [27] HANGUL SYLLABLE NWIG..HANGUL SYLLABLE NWIH
                        if (0xb259 <= code && code <= 0xb273) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb275) {
                          // Lo       HANGUL SYLLABLE NYU
                          if (0xb274 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE NYUG..HANGUL SYLLABLE NYUH
                          if (0xb275 <= code && code <= 0xb28f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb291) {
                        // Lo       HANGUL SYLLABLE NEU
                        if (0xb290 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb2ac) {
                          // Lo  [27] HANGUL SYLLABLE NEUG..HANGUL SYLLABLE NEUH
                          if (0xb291 <= code && code <= 0xb2ab) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE NYI
                          if (0xb2ac === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xb300) {
                    if (code < 0xb2c9) {
                      if (code < 0xb2c8) {
                        // Lo  [27] HANGUL SYLLABLE NYIG..HANGUL SYLLABLE NYIH
                        if (0xb2ad <= code && code <= 0xb2c7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE NI
                        if (0xb2c8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb2e4) {
                        // Lo  [27] HANGUL SYLLABLE NIG..HANGUL SYLLABLE NIH
                        if (0xb2c9 <= code && code <= 0xb2e3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb2e5) {
                          // Lo       HANGUL SYLLABLE DA
                          if (0xb2e4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DAG..HANGUL SYLLABLE DAH
                          if (0xb2e5 <= code && code <= 0xb2ff) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb31d) {
                      if (code < 0xb301) {
                        // Lo       HANGUL SYLLABLE DAE
                        if (0xb300 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb31c) {
                          // Lo  [27] HANGUL SYLLABLE DAEG..HANGUL SYLLABLE DAEH
                          if (0xb301 <= code && code <= 0xb31b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DYA
                          if (0xb31c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb338) {
                        // Lo  [27] HANGUL SYLLABLE DYAG..HANGUL SYLLABLE DYAH
                        if (0xb31d <= code && code <= 0xb337) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb339) {
                          // Lo       HANGUL SYLLABLE DYAE
                          if (0xb338 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DYAEG..HANGUL SYLLABLE DYAEH
                          if (0xb339 <= code && code <= 0xb353) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xb46d) {
                if (code < 0xb3e0) {
                  if (code < 0xb38d) {
                    if (code < 0xb370) {
                      if (code < 0xb355) {
                        // Lo       HANGUL SYLLABLE DEO
                        if (0xb354 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE DEOG..HANGUL SYLLABLE DEOH
                        if (0xb355 <= code && code <= 0xb36f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb371) {
                        // Lo       HANGUL SYLLABLE DE
                        if (0xb370 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb38c) {
                          // Lo  [27] HANGUL SYLLABLE DEG..HANGUL SYLLABLE DEH
                          if (0xb371 <= code && code <= 0xb38b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DYEO
                          if (0xb38c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb3a9) {
                      if (code < 0xb3a8) {
                        // Lo  [27] HANGUL SYLLABLE DYEOG..HANGUL SYLLABLE DYEOH
                        if (0xb38d <= code && code <= 0xb3a7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE DYE
                        if (0xb3a8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb3c4) {
                        // Lo  [27] HANGUL SYLLABLE DYEG..HANGUL SYLLABLE DYEH
                        if (0xb3a9 <= code && code <= 0xb3c3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb3c5) {
                          // Lo       HANGUL SYLLABLE DO
                          if (0xb3c4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DOG..HANGUL SYLLABLE DOH
                          if (0xb3c5 <= code && code <= 0xb3df) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xb419) {
                    if (code < 0xb3fc) {
                      if (code < 0xb3e1) {
                        // Lo       HANGUL SYLLABLE DWA
                        if (0xb3e0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE DWAG..HANGUL SYLLABLE DWAH
                        if (0xb3e1 <= code && code <= 0xb3fb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb3fd) {
                        // Lo       HANGUL SYLLABLE DWAE
                        if (0xb3fc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb418) {
                          // Lo  [27] HANGUL SYLLABLE DWAEG..HANGUL SYLLABLE DWAEH
                          if (0xb3fd <= code && code <= 0xb417) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DOE
                          if (0xb418 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb450) {
                      if (code < 0xb434) {
                        // Lo  [27] HANGUL SYLLABLE DOEG..HANGUL SYLLABLE DOEH
                        if (0xb419 <= code && code <= 0xb433) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb435) {
                          // Lo       HANGUL SYLLABLE DYO
                          if (0xb434 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DYOG..HANGUL SYLLABLE DYOH
                          if (0xb435 <= code && code <= 0xb44f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb451) {
                        // Lo       HANGUL SYLLABLE DU
                        if (0xb450 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb46c) {
                          // Lo  [27] HANGUL SYLLABLE DUG..HANGUL SYLLABLE DUH
                          if (0xb451 <= code && code <= 0xb46b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DWEO
                          if (0xb46c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xb514) {
                  if (code < 0xb4c0) {
                    if (code < 0xb489) {
                      if (code < 0xb488) {
                        // Lo  [27] HANGUL SYLLABLE DWEOG..HANGUL SYLLABLE DWEOH
                        if (0xb46d <= code && code <= 0xb487) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE DWE
                        if (0xb488 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb4a4) {
                        // Lo  [27] HANGUL SYLLABLE DWEG..HANGUL SYLLABLE DWEH
                        if (0xb489 <= code && code <= 0xb4a3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb4a5) {
                          // Lo       HANGUL SYLLABLE DWI
                          if (0xb4a4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DWIG..HANGUL SYLLABLE DWIH
                          if (0xb4a5 <= code && code <= 0xb4bf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb4dd) {
                      if (code < 0xb4c1) {
                        // Lo       HANGUL SYLLABLE DYU
                        if (0xb4c0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb4dc) {
                          // Lo  [27] HANGUL SYLLABLE DYUG..HANGUL SYLLABLE DYUH
                          if (0xb4c1 <= code && code <= 0xb4db) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DEU
                          if (0xb4dc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb4f8) {
                        // Lo  [27] HANGUL SYLLABLE DEUG..HANGUL SYLLABLE DEUH
                        if (0xb4dd <= code && code <= 0xb4f7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb4f9) {
                          // Lo       HANGUL SYLLABLE DYI
                          if (0xb4f8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DYIG..HANGUL SYLLABLE DYIH
                          if (0xb4f9 <= code && code <= 0xb513) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xb54d) {
                    if (code < 0xb530) {
                      if (code < 0xb515) {
                        // Lo       HANGUL SYLLABLE DI
                        if (0xb514 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE DIG..HANGUL SYLLABLE DIH
                        if (0xb515 <= code && code <= 0xb52f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb531) {
                        // Lo       HANGUL SYLLABLE DDA
                        if (0xb530 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb54c) {
                          // Lo  [27] HANGUL SYLLABLE DDAG..HANGUL SYLLABLE DDAH
                          if (0xb531 <= code && code <= 0xb54b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DDAE
                          if (0xb54c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb584) {
                      if (code < 0xb568) {
                        // Lo  [27] HANGUL SYLLABLE DDAEG..HANGUL SYLLABLE DDAEH
                        if (0xb54d <= code && code <= 0xb567) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb569) {
                          // Lo       HANGUL SYLLABLE DDYA
                          if (0xb568 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DDYAG..HANGUL SYLLABLE DDYAH
                          if (0xb569 <= code && code <= 0xb583) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb585) {
                        // Lo       HANGUL SYLLABLE DDYAE
                        if (0xb584 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb5a0) {
                          // Lo  [27] HANGUL SYLLABLE DDYAEG..HANGUL SYLLABLE DDYAEH
                          if (0xb585 <= code && code <= 0xb59f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DDEO
                          if (0xb5a0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          if (code < 0xba55) {
            if (code < 0xb808) {
              if (code < 0xb6d4) {
                if (code < 0xb62d) {
                  if (code < 0xb5f4) {
                    if (code < 0xb5bd) {
                      if (code < 0xb5bc) {
                        // Lo  [27] HANGUL SYLLABLE DDEOG..HANGUL SYLLABLE DDEOH
                        if (0xb5a1 <= code && code <= 0xb5bb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE DDE
                        if (0xb5bc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb5d8) {
                        // Lo  [27] HANGUL SYLLABLE DDEG..HANGUL SYLLABLE DDEH
                        if (0xb5bd <= code && code <= 0xb5d7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb5d9) {
                          // Lo       HANGUL SYLLABLE DDYEO
                          if (0xb5d8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DDYEOG..HANGUL SYLLABLE DDYEOH
                          if (0xb5d9 <= code && code <= 0xb5f3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb610) {
                      if (code < 0xb5f5) {
                        // Lo       HANGUL SYLLABLE DDYE
                        if (0xb5f4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE DDYEG..HANGUL SYLLABLE DDYEH
                        if (0xb5f5 <= code && code <= 0xb60f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb611) {
                        // Lo       HANGUL SYLLABLE DDO
                        if (0xb610 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb62c) {
                          // Lo  [27] HANGUL SYLLABLE DDOG..HANGUL SYLLABLE DDOH
                          if (0xb611 <= code && code <= 0xb62b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DDWA
                          if (0xb62c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xb680) {
                    if (code < 0xb649) {
                      if (code < 0xb648) {
                        // Lo  [27] HANGUL SYLLABLE DDWAG..HANGUL SYLLABLE DDWAH
                        if (0xb62d <= code && code <= 0xb647) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE DDWAE
                        if (0xb648 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb664) {
                        // Lo  [27] HANGUL SYLLABLE DDWAEG..HANGUL SYLLABLE DDWAEH
                        if (0xb649 <= code && code <= 0xb663) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb665) {
                          // Lo       HANGUL SYLLABLE DDOE
                          if (0xb664 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DDOEG..HANGUL SYLLABLE DDOEH
                          if (0xb665 <= code && code <= 0xb67f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb69d) {
                      if (code < 0xb681) {
                        // Lo       HANGUL SYLLABLE DDYO
                        if (0xb680 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb69c) {
                          // Lo  [27] HANGUL SYLLABLE DDYOG..HANGUL SYLLABLE DDYOH
                          if (0xb681 <= code && code <= 0xb69b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DDU
                          if (0xb69c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb6b8) {
                        // Lo  [27] HANGUL SYLLABLE DDUG..HANGUL SYLLABLE DDUH
                        if (0xb69d <= code && code <= 0xb6b7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb6b9) {
                          // Lo       HANGUL SYLLABLE DDWEO
                          if (0xb6b8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DDWEOG..HANGUL SYLLABLE DDWEOH
                          if (0xb6b9 <= code && code <= 0xb6d3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xb761) {
                  if (code < 0xb70d) {
                    if (code < 0xb6f0) {
                      if (code < 0xb6d5) {
                        // Lo       HANGUL SYLLABLE DDWE
                        if (0xb6d4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE DDWEG..HANGUL SYLLABLE DDWEH
                        if (0xb6d5 <= code && code <= 0xb6ef) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb6f1) {
                        // Lo       HANGUL SYLLABLE DDWI
                        if (0xb6f0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb70c) {
                          // Lo  [27] HANGUL SYLLABLE DDWIG..HANGUL SYLLABLE DDWIH
                          if (0xb6f1 <= code && code <= 0xb70b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DDYU
                          if (0xb70c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb744) {
                      if (code < 0xb728) {
                        // Lo  [27] HANGUL SYLLABLE DDYUG..HANGUL SYLLABLE DDYUH
                        if (0xb70d <= code && code <= 0xb727) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb729) {
                          // Lo       HANGUL SYLLABLE DDEU
                          if (0xb728 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE DDEUG..HANGUL SYLLABLE DDEUH
                          if (0xb729 <= code && code <= 0xb743) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb745) {
                        // Lo       HANGUL SYLLABLE DDYI
                        if (0xb744 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb760) {
                          // Lo  [27] HANGUL SYLLABLE DDYIG..HANGUL SYLLABLE DDYIH
                          if (0xb745 <= code && code <= 0xb75f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE DDI
                          if (0xb760 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xb7b4) {
                    if (code < 0xb77d) {
                      if (code < 0xb77c) {
                        // Lo  [27] HANGUL SYLLABLE DDIG..HANGUL SYLLABLE DDIH
                        if (0xb761 <= code && code <= 0xb77b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE RA
                        if (0xb77c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb798) {
                        // Lo  [27] HANGUL SYLLABLE RAG..HANGUL SYLLABLE RAH
                        if (0xb77d <= code && code <= 0xb797) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb799) {
                          // Lo       HANGUL SYLLABLE RAE
                          if (0xb798 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE RAEG..HANGUL SYLLABLE RAEH
                          if (0xb799 <= code && code <= 0xb7b3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb7d1) {
                      if (code < 0xb7b5) {
                        // Lo       HANGUL SYLLABLE RYA
                        if (0xb7b4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb7d0) {
                          // Lo  [27] HANGUL SYLLABLE RYAG..HANGUL SYLLABLE RYAH
                          if (0xb7b5 <= code && code <= 0xb7cf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE RYAE
                          if (0xb7d0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb7ec) {
                        // Lo  [27] HANGUL SYLLABLE RYAEG..HANGUL SYLLABLE RYAEH
                        if (0xb7d1 <= code && code <= 0xb7eb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb7ed) {
                          // Lo       HANGUL SYLLABLE REO
                          if (0xb7ec === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE REOG..HANGUL SYLLABLE REOH
                          if (0xb7ed <= code && code <= 0xb807) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xb921) {
                if (code < 0xb894) {
                  if (code < 0xb841) {
                    if (code < 0xb824) {
                      if (code < 0xb809) {
                        // Lo       HANGUL SYLLABLE RE
                        if (0xb808 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE REG..HANGUL SYLLABLE REH
                        if (0xb809 <= code && code <= 0xb823) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb825) {
                        // Lo       HANGUL SYLLABLE RYEO
                        if (0xb824 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb840) {
                          // Lo  [27] HANGUL SYLLABLE RYEOG..HANGUL SYLLABLE RYEOH
                          if (0xb825 <= code && code <= 0xb83f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE RYE
                          if (0xb840 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb85d) {
                      if (code < 0xb85c) {
                        // Lo  [27] HANGUL SYLLABLE RYEG..HANGUL SYLLABLE RYEH
                        if (0xb841 <= code && code <= 0xb85b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE RO
                        if (0xb85c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb878) {
                        // Lo  [27] HANGUL SYLLABLE ROG..HANGUL SYLLABLE ROH
                        if (0xb85d <= code && code <= 0xb877) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb879) {
                          // Lo       HANGUL SYLLABLE RWA
                          if (0xb878 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE RWAG..HANGUL SYLLABLE RWAH
                          if (0xb879 <= code && code <= 0xb893) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xb8cd) {
                    if (code < 0xb8b0) {
                      if (code < 0xb895) {
                        // Lo       HANGUL SYLLABLE RWAE
                        if (0xb894 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE RWAEG..HANGUL SYLLABLE RWAEH
                        if (0xb895 <= code && code <= 0xb8af) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb8b1) {
                        // Lo       HANGUL SYLLABLE ROE
                        if (0xb8b0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb8cc) {
                          // Lo  [27] HANGUL SYLLABLE ROEG..HANGUL SYLLABLE ROEH
                          if (0xb8b1 <= code && code <= 0xb8cb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE RYO
                          if (0xb8cc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb904) {
                      if (code < 0xb8e8) {
                        // Lo  [27] HANGUL SYLLABLE RYOG..HANGUL SYLLABLE RYOH
                        if (0xb8cd <= code && code <= 0xb8e7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb8e9) {
                          // Lo       HANGUL SYLLABLE RU
                          if (0xb8e8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE RUG..HANGUL SYLLABLE RUH
                          if (0xb8e9 <= code && code <= 0xb903) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb905) {
                        // Lo       HANGUL SYLLABLE RWEO
                        if (0xb904 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb920) {
                          // Lo  [27] HANGUL SYLLABLE RWEOG..HANGUL SYLLABLE RWEOH
                          if (0xb905 <= code && code <= 0xb91f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE RWE
                          if (0xb920 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xb9c8) {
                  if (code < 0xb974) {
                    if (code < 0xb93d) {
                      if (code < 0xb93c) {
                        // Lo  [27] HANGUL SYLLABLE RWEG..HANGUL SYLLABLE RWEH
                        if (0xb921 <= code && code <= 0xb93b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE RWI
                        if (0xb93c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xb958) {
                        // Lo  [27] HANGUL SYLLABLE RWIG..HANGUL SYLLABLE RWIH
                        if (0xb93d <= code && code <= 0xb957) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb959) {
                          // Lo       HANGUL SYLLABLE RYU
                          if (0xb958 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE RYUG..HANGUL SYLLABLE RYUH
                          if (0xb959 <= code && code <= 0xb973) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xb991) {
                      if (code < 0xb975) {
                        // Lo       HANGUL SYLLABLE REU
                        if (0xb974 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xb990) {
                          // Lo  [27] HANGUL SYLLABLE REUG..HANGUL SYLLABLE REUH
                          if (0xb975 <= code && code <= 0xb98f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE RYI
                          if (0xb990 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xb9ac) {
                        // Lo  [27] HANGUL SYLLABLE RYIG..HANGUL SYLLABLE RYIH
                        if (0xb991 <= code && code <= 0xb9ab) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xb9ad) {
                          // Lo       HANGUL SYLLABLE RI
                          if (0xb9ac === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE RIG..HANGUL SYLLABLE RIH
                          if (0xb9ad <= code && code <= 0xb9c7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xba01) {
                    if (code < 0xb9e4) {
                      if (code < 0xb9c9) {
                        // Lo       HANGUL SYLLABLE MA
                        if (0xb9c8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE MAG..HANGUL SYLLABLE MAH
                        if (0xb9c9 <= code && code <= 0xb9e3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xb9e5) {
                        // Lo       HANGUL SYLLABLE MAE
                        if (0xb9e4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xba00) {
                          // Lo  [27] HANGUL SYLLABLE MAEG..HANGUL SYLLABLE MAEH
                          if (0xb9e5 <= code && code <= 0xb9ff) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE MYA
                          if (0xba00 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xba38) {
                      if (code < 0xba1c) {
                        // Lo  [27] HANGUL SYLLABLE MYAG..HANGUL SYLLABLE MYAH
                        if (0xba01 <= code && code <= 0xba1b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xba1d) {
                          // Lo       HANGUL SYLLABLE MYAE
                          if (0xba1c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE MYAEG..HANGUL SYLLABLE MYAEH
                          if (0xba1d <= code && code <= 0xba37) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xba39) {
                        // Lo       HANGUL SYLLABLE MEO
                        if (0xba38 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xba54) {
                          // Lo  [27] HANGUL SYLLABLE MEOG..HANGUL SYLLABLE MEOH
                          if (0xba39 <= code && code <= 0xba53) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE ME
                          if (0xba54 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 0xbcbc) {
              if (code < 0xbb88) {
                if (code < 0xbae1) {
                  if (code < 0xbaa8) {
                    if (code < 0xba71) {
                      if (code < 0xba70) {
                        // Lo  [27] HANGUL SYLLABLE MEG..HANGUL SYLLABLE MEH
                        if (0xba55 <= code && code <= 0xba6f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE MYEO
                        if (0xba70 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xba8c) {
                        // Lo  [27] HANGUL SYLLABLE MYEOG..HANGUL SYLLABLE MYEOH
                        if (0xba71 <= code && code <= 0xba8b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xba8d) {
                          // Lo       HANGUL SYLLABLE MYE
                          if (0xba8c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE MYEG..HANGUL SYLLABLE MYEH
                          if (0xba8d <= code && code <= 0xbaa7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbac4) {
                      if (code < 0xbaa9) {
                        // Lo       HANGUL SYLLABLE MO
                        if (0xbaa8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE MOG..HANGUL SYLLABLE MOH
                        if (0xbaa9 <= code && code <= 0xbac3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xbac5) {
                        // Lo       HANGUL SYLLABLE MWA
                        if (0xbac4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbae0) {
                          // Lo  [27] HANGUL SYLLABLE MWAG..HANGUL SYLLABLE MWAH
                          if (0xbac5 <= code && code <= 0xbadf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE MWAE
                          if (0xbae0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xbb34) {
                    if (code < 0xbafd) {
                      if (code < 0xbafc) {
                        // Lo  [27] HANGUL SYLLABLE MWAEG..HANGUL SYLLABLE MWAEH
                        if (0xbae1 <= code && code <= 0xbafb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE MOE
                        if (0xbafc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xbb18) {
                        // Lo  [27] HANGUL SYLLABLE MOEG..HANGUL SYLLABLE MOEH
                        if (0xbafd <= code && code <= 0xbb17) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbb19) {
                          // Lo       HANGUL SYLLABLE MYO
                          if (0xbb18 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE MYOG..HANGUL SYLLABLE MYOH
                          if (0xbb19 <= code && code <= 0xbb33) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbb51) {
                      if (code < 0xbb35) {
                        // Lo       HANGUL SYLLABLE MU
                        if (0xbb34 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbb50) {
                          // Lo  [27] HANGUL SYLLABLE MUG..HANGUL SYLLABLE MUH
                          if (0xbb35 <= code && code <= 0xbb4f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE MWEO
                          if (0xbb50 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xbb6c) {
                        // Lo  [27] HANGUL SYLLABLE MWEOG..HANGUL SYLLABLE MWEOH
                        if (0xbb51 <= code && code <= 0xbb6b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbb6d) {
                          // Lo       HANGUL SYLLABLE MWE
                          if (0xbb6c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE MWEG..HANGUL SYLLABLE MWEH
                          if (0xbb6d <= code && code <= 0xbb87) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xbc15) {
                  if (code < 0xbbc1) {
                    if (code < 0xbba4) {
                      if (code < 0xbb89) {
                        // Lo       HANGUL SYLLABLE MWI
                        if (0xbb88 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE MWIG..HANGUL SYLLABLE MWIH
                        if (0xbb89 <= code && code <= 0xbba3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xbba5) {
                        // Lo       HANGUL SYLLABLE MYU
                        if (0xbba4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbbc0) {
                          // Lo  [27] HANGUL SYLLABLE MYUG..HANGUL SYLLABLE MYUH
                          if (0xbba5 <= code && code <= 0xbbbf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE MEU
                          if (0xbbc0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbbf8) {
                      if (code < 0xbbdc) {
                        // Lo  [27] HANGUL SYLLABLE MEUG..HANGUL SYLLABLE MEUH
                        if (0xbbc1 <= code && code <= 0xbbdb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbbdd) {
                          // Lo       HANGUL SYLLABLE MYI
                          if (0xbbdc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE MYIG..HANGUL SYLLABLE MYIH
                          if (0xbbdd <= code && code <= 0xbbf7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xbbf9) {
                        // Lo       HANGUL SYLLABLE MI
                        if (0xbbf8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbc14) {
                          // Lo  [27] HANGUL SYLLABLE MIG..HANGUL SYLLABLE MIH
                          if (0xbbf9 <= code && code <= 0xbc13) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BA
                          if (0xbc14 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xbc68) {
                    if (code < 0xbc31) {
                      if (code < 0xbc30) {
                        // Lo  [27] HANGUL SYLLABLE BAG..HANGUL SYLLABLE BAH
                        if (0xbc15 <= code && code <= 0xbc2f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE BAE
                        if (0xbc30 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xbc4c) {
                        // Lo  [27] HANGUL SYLLABLE BAEG..HANGUL SYLLABLE BAEH
                        if (0xbc31 <= code && code <= 0xbc4b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbc4d) {
                          // Lo       HANGUL SYLLABLE BYA
                          if (0xbc4c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BYAG..HANGUL SYLLABLE BYAH
                          if (0xbc4d <= code && code <= 0xbc67) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbc85) {
                      if (code < 0xbc69) {
                        // Lo       HANGUL SYLLABLE BYAE
                        if (0xbc68 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbc84) {
                          // Lo  [27] HANGUL SYLLABLE BYAEG..HANGUL SYLLABLE BYAEH
                          if (0xbc69 <= code && code <= 0xbc83) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BEO
                          if (0xbc84 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xbca0) {
                        // Lo  [27] HANGUL SYLLABLE BEOG..HANGUL SYLLABLE BEOH
                        if (0xbc85 <= code && code <= 0xbc9f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbca1) {
                          // Lo       HANGUL SYLLABLE BE
                          if (0xbca0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BEG..HANGUL SYLLABLE BEH
                          if (0xbca1 <= code && code <= 0xbcbb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xbdd5) {
                if (code < 0xbd48) {
                  if (code < 0xbcf5) {
                    if (code < 0xbcd8) {
                      if (code < 0xbcbd) {
                        // Lo       HANGUL SYLLABLE BYEO
                        if (0xbcbc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE BYEOG..HANGUL SYLLABLE BYEOH
                        if (0xbcbd <= code && code <= 0xbcd7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xbcd9) {
                        // Lo       HANGUL SYLLABLE BYE
                        if (0xbcd8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbcf4) {
                          // Lo  [27] HANGUL SYLLABLE BYEG..HANGUL SYLLABLE BYEH
                          if (0xbcd9 <= code && code <= 0xbcf3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BO
                          if (0xbcf4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbd11) {
                      if (code < 0xbd10) {
                        // Lo  [27] HANGUL SYLLABLE BOG..HANGUL SYLLABLE BOH
                        if (0xbcf5 <= code && code <= 0xbd0f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE BWA
                        if (0xbd10 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xbd2c) {
                        // Lo  [27] HANGUL SYLLABLE BWAG..HANGUL SYLLABLE BWAH
                        if (0xbd11 <= code && code <= 0xbd2b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbd2d) {
                          // Lo       HANGUL SYLLABLE BWAE
                          if (0xbd2c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BWAEG..HANGUL SYLLABLE BWAEH
                          if (0xbd2d <= code && code <= 0xbd47) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xbd81) {
                    if (code < 0xbd64) {
                      if (code < 0xbd49) {
                        // Lo       HANGUL SYLLABLE BOE
                        if (0xbd48 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE BOEG..HANGUL SYLLABLE BOEH
                        if (0xbd49 <= code && code <= 0xbd63) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xbd65) {
                        // Lo       HANGUL SYLLABLE BYO
                        if (0xbd64 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbd80) {
                          // Lo  [27] HANGUL SYLLABLE BYOG..HANGUL SYLLABLE BYOH
                          if (0xbd65 <= code && code <= 0xbd7f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BU
                          if (0xbd80 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbdb8) {
                      if (code < 0xbd9c) {
                        // Lo  [27] HANGUL SYLLABLE BUG..HANGUL SYLLABLE BUH
                        if (0xbd81 <= code && code <= 0xbd9b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbd9d) {
                          // Lo       HANGUL SYLLABLE BWEO
                          if (0xbd9c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BWEOG..HANGUL SYLLABLE BWEOH
                          if (0xbd9d <= code && code <= 0xbdb7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xbdb9) {
                        // Lo       HANGUL SYLLABLE BWE
                        if (0xbdb8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbdd4) {
                          // Lo  [27] HANGUL SYLLABLE BWEG..HANGUL SYLLABLE BWEH
                          if (0xbdb9 <= code && code <= 0xbdd3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BWI
                          if (0xbdd4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xbe7c) {
                  if (code < 0xbe28) {
                    if (code < 0xbdf1) {
                      if (code < 0xbdf0) {
                        // Lo  [27] HANGUL SYLLABLE BWIG..HANGUL SYLLABLE BWIH
                        if (0xbdd5 <= code && code <= 0xbdef) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE BYU
                        if (0xbdf0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xbe0c) {
                        // Lo  [27] HANGUL SYLLABLE BYUG..HANGUL SYLLABLE BYUH
                        if (0xbdf1 <= code && code <= 0xbe0b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbe0d) {
                          // Lo       HANGUL SYLLABLE BEU
                          if (0xbe0c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BEUG..HANGUL SYLLABLE BEUH
                          if (0xbe0d <= code && code <= 0xbe27) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbe45) {
                      if (code < 0xbe29) {
                        // Lo       HANGUL SYLLABLE BYI
                        if (0xbe28 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbe44) {
                          // Lo  [27] HANGUL SYLLABLE BYIG..HANGUL SYLLABLE BYIH
                          if (0xbe29 <= code && code <= 0xbe43) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BI
                          if (0xbe44 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xbe60) {
                        // Lo  [27] HANGUL SYLLABLE BIG..HANGUL SYLLABLE BIH
                        if (0xbe45 <= code && code <= 0xbe5f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbe61) {
                          // Lo       HANGUL SYLLABLE BBA
                          if (0xbe60 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BBAG..HANGUL SYLLABLE BBAH
                          if (0xbe61 <= code && code <= 0xbe7b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xbeb5) {
                    if (code < 0xbe98) {
                      if (code < 0xbe7d) {
                        // Lo       HANGUL SYLLABLE BBAE
                        if (0xbe7c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE BBAEG..HANGUL SYLLABLE BBAEH
                        if (0xbe7d <= code && code <= 0xbe97) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xbe99) {
                        // Lo       HANGUL SYLLABLE BBYA
                        if (0xbe98 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbeb4) {
                          // Lo  [27] HANGUL SYLLABLE BBYAG..HANGUL SYLLABLE BBYAH
                          if (0xbe99 <= code && code <= 0xbeb3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BBYAE
                          if (0xbeb4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbeec) {
                      if (code < 0xbed0) {
                        // Lo  [27] HANGUL SYLLABLE BBYAEG..HANGUL SYLLABLE BBYAEH
                        if (0xbeb5 <= code && code <= 0xbecf) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbed1) {
                          // Lo       HANGUL SYLLABLE BBEO
                          if (0xbed0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BBEOG..HANGUL SYLLABLE BBEOH
                          if (0xbed1 <= code && code <= 0xbeeb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xbeed) {
                        // Lo       HANGUL SYLLABLE BBE
                        if (0xbeec === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbf08) {
                          // Lo  [27] HANGUL SYLLABLE BBEG..HANGUL SYLLABLE BBEH
                          if (0xbeed <= code && code <= 0xbf07) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BBYEO
                          if (0xbf08 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      if (code < 0xd1d8) {
        if (code < 0xc870) {
          if (code < 0xc3bc) {
            if (code < 0xc155) {
              if (code < 0xc03c) {
                if (code < 0xbf95) {
                  if (code < 0xbf5c) {
                    if (code < 0xbf25) {
                      if (code < 0xbf24) {
                        // Lo  [27] HANGUL SYLLABLE BBYEOG..HANGUL SYLLABLE BBYEOH
                        if (0xbf09 <= code && code <= 0xbf23) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE BBYE
                        if (0xbf24 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xbf40) {
                        // Lo  [27] HANGUL SYLLABLE BBYEG..HANGUL SYLLABLE BBYEH
                        if (0xbf25 <= code && code <= 0xbf3f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbf41) {
                          // Lo       HANGUL SYLLABLE BBO
                          if (0xbf40 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BBOG..HANGUL SYLLABLE BBOH
                          if (0xbf41 <= code && code <= 0xbf5b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xbf78) {
                      if (code < 0xbf5d) {
                        // Lo       HANGUL SYLLABLE BBWA
                        if (0xbf5c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE BBWAG..HANGUL SYLLABLE BBWAH
                        if (0xbf5d <= code && code <= 0xbf77) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xbf79) {
                        // Lo       HANGUL SYLLABLE BBWAE
                        if (0xbf78 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xbf94) {
                          // Lo  [27] HANGUL SYLLABLE BBWAEG..HANGUL SYLLABLE BBWAEH
                          if (0xbf79 <= code && code <= 0xbf93) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BBOE
                          if (0xbf94 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xbfe8) {
                    if (code < 0xbfb1) {
                      if (code < 0xbfb0) {
                        // Lo  [27] HANGUL SYLLABLE BBOEG..HANGUL SYLLABLE BBOEH
                        if (0xbf95 <= code && code <= 0xbfaf) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE BBYO
                        if (0xbfb0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xbfcc) {
                        // Lo  [27] HANGUL SYLLABLE BBYOG..HANGUL SYLLABLE BBYOH
                        if (0xbfb1 <= code && code <= 0xbfcb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xbfcd) {
                          // Lo       HANGUL SYLLABLE BBU
                          if (0xbfcc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BBUG..HANGUL SYLLABLE BBUH
                          if (0xbfcd <= code && code <= 0xbfe7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc005) {
                      if (code < 0xbfe9) {
                        // Lo       HANGUL SYLLABLE BBWEO
                        if (0xbfe8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc004) {
                          // Lo  [27] HANGUL SYLLABLE BBWEOG..HANGUL SYLLABLE BBWEOH
                          if (0xbfe9 <= code && code <= 0xc003) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BBWE
                          if (0xc004 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc020) {
                        // Lo  [27] HANGUL SYLLABLE BBWEG..HANGUL SYLLABLE BBWEH
                        if (0xc005 <= code && code <= 0xc01f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc021) {
                          // Lo       HANGUL SYLLABLE BBWI
                          if (0xc020 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE BBWIG..HANGUL SYLLABLE BBWIH
                          if (0xc021 <= code && code <= 0xc03b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xc0c8) {
                  if (code < 0xc075) {
                    if (code < 0xc058) {
                      if (code < 0xc03d) {
                        // Lo       HANGUL SYLLABLE BBYU
                        if (0xc03c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE BBYUG..HANGUL SYLLABLE BBYUH
                        if (0xc03d <= code && code <= 0xc057) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc059) {
                        // Lo       HANGUL SYLLABLE BBEU
                        if (0xc058 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc074) {
                          // Lo  [27] HANGUL SYLLABLE BBEUG..HANGUL SYLLABLE BBEUH
                          if (0xc059 <= code && code <= 0xc073) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE BBYI
                          if (0xc074 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc091) {
                      if (code < 0xc090) {
                        // Lo  [27] HANGUL SYLLABLE BBYIG..HANGUL SYLLABLE BBYIH
                        if (0xc075 <= code && code <= 0xc08f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE BBI
                        if (0xc090 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc0ac) {
                        // Lo  [27] HANGUL SYLLABLE BBIG..HANGUL SYLLABLE BBIH
                        if (0xc091 <= code && code <= 0xc0ab) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc0ad) {
                          // Lo       HANGUL SYLLABLE SA
                          if (0xc0ac === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SAG..HANGUL SYLLABLE SAH
                          if (0xc0ad <= code && code <= 0xc0c7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xc101) {
                    if (code < 0xc0e4) {
                      if (code < 0xc0c9) {
                        // Lo       HANGUL SYLLABLE SAE
                        if (0xc0c8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE SAEG..HANGUL SYLLABLE SAEH
                        if (0xc0c9 <= code && code <= 0xc0e3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc0e5) {
                        // Lo       HANGUL SYLLABLE SYA
                        if (0xc0e4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc100) {
                          // Lo  [27] HANGUL SYLLABLE SYAG..HANGUL SYLLABLE SYAH
                          if (0xc0e5 <= code && code <= 0xc0ff) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SYAE
                          if (0xc100 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc138) {
                      if (code < 0xc11c) {
                        // Lo  [27] HANGUL SYLLABLE SYAEG..HANGUL SYLLABLE SYAEH
                        if (0xc101 <= code && code <= 0xc11b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc11d) {
                          // Lo       HANGUL SYLLABLE SEO
                          if (0xc11c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SEOG..HANGUL SYLLABLE SEOH
                          if (0xc11d <= code && code <= 0xc137) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc139) {
                        // Lo       HANGUL SYLLABLE SE
                        if (0xc138 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc154) {
                          // Lo  [27] HANGUL SYLLABLE SEG..HANGUL SYLLABLE SEH
                          if (0xc139 <= code && code <= 0xc153) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SYEO
                          if (0xc154 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xc288) {
                if (code < 0xc1e1) {
                  if (code < 0xc1a8) {
                    if (code < 0xc171) {
                      if (code < 0xc170) {
                        // Lo  [27] HANGUL SYLLABLE SYEOG..HANGUL SYLLABLE SYEOH
                        if (0xc155 <= code && code <= 0xc16f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE SYE
                        if (0xc170 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc18c) {
                        // Lo  [27] HANGUL SYLLABLE SYEG..HANGUL SYLLABLE SYEH
                        if (0xc171 <= code && code <= 0xc18b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc18d) {
                          // Lo       HANGUL SYLLABLE SO
                          if (0xc18c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SOG..HANGUL SYLLABLE SOH
                          if (0xc18d <= code && code <= 0xc1a7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc1c4) {
                      if (code < 0xc1a9) {
                        // Lo       HANGUL SYLLABLE SWA
                        if (0xc1a8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE SWAG..HANGUL SYLLABLE SWAH
                        if (0xc1a9 <= code && code <= 0xc1c3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc1c5) {
                        // Lo       HANGUL SYLLABLE SWAE
                        if (0xc1c4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc1e0) {
                          // Lo  [27] HANGUL SYLLABLE SWAEG..HANGUL SYLLABLE SWAEH
                          if (0xc1c5 <= code && code <= 0xc1df) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SOE
                          if (0xc1e0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xc234) {
                    if (code < 0xc1fd) {
                      if (code < 0xc1fc) {
                        // Lo  [27] HANGUL SYLLABLE SOEG..HANGUL SYLLABLE SOEH
                        if (0xc1e1 <= code && code <= 0xc1fb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE SYO
                        if (0xc1fc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc218) {
                        // Lo  [27] HANGUL SYLLABLE SYOG..HANGUL SYLLABLE SYOH
                        if (0xc1fd <= code && code <= 0xc217) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc219) {
                          // Lo       HANGUL SYLLABLE SU
                          if (0xc218 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SUG..HANGUL SYLLABLE SUH
                          if (0xc219 <= code && code <= 0xc233) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc251) {
                      if (code < 0xc235) {
                        // Lo       HANGUL SYLLABLE SWEO
                        if (0xc234 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc250) {
                          // Lo  [27] HANGUL SYLLABLE SWEOG..HANGUL SYLLABLE SWEOH
                          if (0xc235 <= code && code <= 0xc24f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SWE
                          if (0xc250 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc26c) {
                        // Lo  [27] HANGUL SYLLABLE SWEG..HANGUL SYLLABLE SWEH
                        if (0xc251 <= code && code <= 0xc26b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc26d) {
                          // Lo       HANGUL SYLLABLE SWI
                          if (0xc26c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SWIG..HANGUL SYLLABLE SWIH
                          if (0xc26d <= code && code <= 0xc287) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xc315) {
                  if (code < 0xc2c1) {
                    if (code < 0xc2a4) {
                      if (code < 0xc289) {
                        // Lo       HANGUL SYLLABLE SYU
                        if (0xc288 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE SYUG..HANGUL SYLLABLE SYUH
                        if (0xc289 <= code && code <= 0xc2a3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc2a5) {
                        // Lo       HANGUL SYLLABLE SEU
                        if (0xc2a4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc2c0) {
                          // Lo  [27] HANGUL SYLLABLE SEUG..HANGUL SYLLABLE SEUH
                          if (0xc2a5 <= code && code <= 0xc2bf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SYI
                          if (0xc2c0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc2f8) {
                      if (code < 0xc2dc) {
                        // Lo  [27] HANGUL SYLLABLE SYIG..HANGUL SYLLABLE SYIH
                        if (0xc2c1 <= code && code <= 0xc2db) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc2dd) {
                          // Lo       HANGUL SYLLABLE SI
                          if (0xc2dc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SIG..HANGUL SYLLABLE SIH
                          if (0xc2dd <= code && code <= 0xc2f7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc2f9) {
                        // Lo       HANGUL SYLLABLE SSA
                        if (0xc2f8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc314) {
                          // Lo  [27] HANGUL SYLLABLE SSAG..HANGUL SYLLABLE SSAH
                          if (0xc2f9 <= code && code <= 0xc313) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SSAE
                          if (0xc314 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xc368) {
                    if (code < 0xc331) {
                      if (code < 0xc330) {
                        // Lo  [27] HANGUL SYLLABLE SSAEG..HANGUL SYLLABLE SSAEH
                        if (0xc315 <= code && code <= 0xc32f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE SSYA
                        if (0xc330 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc34c) {
                        // Lo  [27] HANGUL SYLLABLE SSYAG..HANGUL SYLLABLE SSYAH
                        if (0xc331 <= code && code <= 0xc34b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc34d) {
                          // Lo       HANGUL SYLLABLE SSYAE
                          if (0xc34c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SSYAEG..HANGUL SYLLABLE SSYAEH
                          if (0xc34d <= code && code <= 0xc367) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc385) {
                      if (code < 0xc369) {
                        // Lo       HANGUL SYLLABLE SSEO
                        if (0xc368 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc384) {
                          // Lo  [27] HANGUL SYLLABLE SSEOG..HANGUL SYLLABLE SSEOH
                          if (0xc369 <= code && code <= 0xc383) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SSE
                          if (0xc384 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc3a0) {
                        // Lo  [27] HANGUL SYLLABLE SSEG..HANGUL SYLLABLE SSEH
                        if (0xc385 <= code && code <= 0xc39f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc3a1) {
                          // Lo       HANGUL SYLLABLE SSYEO
                          if (0xc3a0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SSYEOG..HANGUL SYLLABLE SSYEOH
                          if (0xc3a1 <= code && code <= 0xc3bb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 0xc609) {
              if (code < 0xc4d5) {
                if (code < 0xc448) {
                  if (code < 0xc3f5) {
                    if (code < 0xc3d8) {
                      if (code < 0xc3bd) {
                        // Lo       HANGUL SYLLABLE SSYE
                        if (0xc3bc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE SSYEG..HANGUL SYLLABLE SSYEH
                        if (0xc3bd <= code && code <= 0xc3d7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc3d9) {
                        // Lo       HANGUL SYLLABLE SSO
                        if (0xc3d8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc3f4) {
                          // Lo  [27] HANGUL SYLLABLE SSOG..HANGUL SYLLABLE SSOH
                          if (0xc3d9 <= code && code <= 0xc3f3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SSWA
                          if (0xc3f4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc411) {
                      if (code < 0xc410) {
                        // Lo  [27] HANGUL SYLLABLE SSWAG..HANGUL SYLLABLE SSWAH
                        if (0xc3f5 <= code && code <= 0xc40f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE SSWAE
                        if (0xc410 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc42c) {
                        // Lo  [27] HANGUL SYLLABLE SSWAEG..HANGUL SYLLABLE SSWAEH
                        if (0xc411 <= code && code <= 0xc42b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc42d) {
                          // Lo       HANGUL SYLLABLE SSOE
                          if (0xc42c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SSOEG..HANGUL SYLLABLE SSOEH
                          if (0xc42d <= code && code <= 0xc447) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xc481) {
                    if (code < 0xc464) {
                      if (code < 0xc449) {
                        // Lo       HANGUL SYLLABLE SSYO
                        if (0xc448 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE SSYOG..HANGUL SYLLABLE SSYOH
                        if (0xc449 <= code && code <= 0xc463) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc465) {
                        // Lo       HANGUL SYLLABLE SSU
                        if (0xc464 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc480) {
                          // Lo  [27] HANGUL SYLLABLE SSUG..HANGUL SYLLABLE SSUH
                          if (0xc465 <= code && code <= 0xc47f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SSWEO
                          if (0xc480 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc4b8) {
                      if (code < 0xc49c) {
                        // Lo  [27] HANGUL SYLLABLE SSWEOG..HANGUL SYLLABLE SSWEOH
                        if (0xc481 <= code && code <= 0xc49b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc49d) {
                          // Lo       HANGUL SYLLABLE SSWE
                          if (0xc49c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SSWEG..HANGUL SYLLABLE SSWEH
                          if (0xc49d <= code && code <= 0xc4b7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc4b9) {
                        // Lo       HANGUL SYLLABLE SSWI
                        if (0xc4b8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc4d4) {
                          // Lo  [27] HANGUL SYLLABLE SSWIG..HANGUL SYLLABLE SSWIH
                          if (0xc4b9 <= code && code <= 0xc4d3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE SSYU
                          if (0xc4d4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xc57c) {
                  if (code < 0xc528) {
                    if (code < 0xc4f1) {
                      if (code < 0xc4f0) {
                        // Lo  [27] HANGUL SYLLABLE SSYUG..HANGUL SYLLABLE SSYUH
                        if (0xc4d5 <= code && code <= 0xc4ef) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE SSEU
                        if (0xc4f0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc50c) {
                        // Lo  [27] HANGUL SYLLABLE SSEUG..HANGUL SYLLABLE SSEUH
                        if (0xc4f1 <= code && code <= 0xc50b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc50d) {
                          // Lo       HANGUL SYLLABLE SSYI
                          if (0xc50c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE SSYIG..HANGUL SYLLABLE SSYIH
                          if (0xc50d <= code && code <= 0xc527) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc545) {
                      if (code < 0xc529) {
                        // Lo       HANGUL SYLLABLE SSI
                        if (0xc528 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc544) {
                          // Lo  [27] HANGUL SYLLABLE SSIG..HANGUL SYLLABLE SSIH
                          if (0xc529 <= code && code <= 0xc543) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE A
                          if (0xc544 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc560) {
                        // Lo  [27] HANGUL SYLLABLE AG..HANGUL SYLLABLE AH
                        if (0xc545 <= code && code <= 0xc55f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc561) {
                          // Lo       HANGUL SYLLABLE AE
                          if (0xc560 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE AEG..HANGUL SYLLABLE AEH
                          if (0xc561 <= code && code <= 0xc57b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xc5b5) {
                    if (code < 0xc598) {
                      if (code < 0xc57d) {
                        // Lo       HANGUL SYLLABLE YA
                        if (0xc57c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE YAG..HANGUL SYLLABLE YAH
                        if (0xc57d <= code && code <= 0xc597) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc599) {
                        // Lo       HANGUL SYLLABLE YAE
                        if (0xc598 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc5b4) {
                          // Lo  [27] HANGUL SYLLABLE YAEG..HANGUL SYLLABLE YAEH
                          if (0xc599 <= code && code <= 0xc5b3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE EO
                          if (0xc5b4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc5ec) {
                      if (code < 0xc5d0) {
                        // Lo  [27] HANGUL SYLLABLE EOG..HANGUL SYLLABLE EOH
                        if (0xc5b5 <= code && code <= 0xc5cf) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc5d1) {
                          // Lo       HANGUL SYLLABLE E
                          if (0xc5d0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE EG..HANGUL SYLLABLE EH
                          if (0xc5d1 <= code && code <= 0xc5eb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc5ed) {
                        // Lo       HANGUL SYLLABLE YEO
                        if (0xc5ec === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc608) {
                          // Lo  [27] HANGUL SYLLABLE YEOG..HANGUL SYLLABLE YEOH
                          if (0xc5ed <= code && code <= 0xc607) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE YE
                          if (0xc608 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xc73c) {
                if (code < 0xc695) {
                  if (code < 0xc65c) {
                    if (code < 0xc625) {
                      if (code < 0xc624) {
                        // Lo  [27] HANGUL SYLLABLE YEG..HANGUL SYLLABLE YEH
                        if (0xc609 <= code && code <= 0xc623) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE O
                        if (0xc624 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc640) {
                        // Lo  [27] HANGUL SYLLABLE OG..HANGUL SYLLABLE OH
                        if (0xc625 <= code && code <= 0xc63f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc641) {
                          // Lo       HANGUL SYLLABLE WA
                          if (0xc640 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE WAG..HANGUL SYLLABLE WAH
                          if (0xc641 <= code && code <= 0xc65b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc678) {
                      if (code < 0xc65d) {
                        // Lo       HANGUL SYLLABLE WAE
                        if (0xc65c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE WAEG..HANGUL SYLLABLE WAEH
                        if (0xc65d <= code && code <= 0xc677) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc679) {
                        // Lo       HANGUL SYLLABLE OE
                        if (0xc678 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc694) {
                          // Lo  [27] HANGUL SYLLABLE OEG..HANGUL SYLLABLE OEH
                          if (0xc679 <= code && code <= 0xc693) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE YO
                          if (0xc694 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xc6e8) {
                    if (code < 0xc6b1) {
                      if (code < 0xc6b0) {
                        // Lo  [27] HANGUL SYLLABLE YOG..HANGUL SYLLABLE YOH
                        if (0xc695 <= code && code <= 0xc6af) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE U
                        if (0xc6b0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc6cc) {
                        // Lo  [27] HANGUL SYLLABLE UG..HANGUL SYLLABLE UH
                        if (0xc6b1 <= code && code <= 0xc6cb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc6cd) {
                          // Lo       HANGUL SYLLABLE WEO
                          if (0xc6cc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE WEOG..HANGUL SYLLABLE WEOH
                          if (0xc6cd <= code && code <= 0xc6e7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc705) {
                      if (code < 0xc6e9) {
                        // Lo       HANGUL SYLLABLE WE
                        if (0xc6e8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc704) {
                          // Lo  [27] HANGUL SYLLABLE WEG..HANGUL SYLLABLE WEH
                          if (0xc6e9 <= code && code <= 0xc703) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE WI
                          if (0xc704 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc720) {
                        // Lo  [27] HANGUL SYLLABLE WIG..HANGUL SYLLABLE WIH
                        if (0xc705 <= code && code <= 0xc71f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc721) {
                          // Lo       HANGUL SYLLABLE YU
                          if (0xc720 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE YUG..HANGUL SYLLABLE YUH
                          if (0xc721 <= code && code <= 0xc73b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xc7c9) {
                  if (code < 0xc775) {
                    if (code < 0xc758) {
                      if (code < 0xc73d) {
                        // Lo       HANGUL SYLLABLE EU
                        if (0xc73c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE EUG..HANGUL SYLLABLE EUH
                        if (0xc73d <= code && code <= 0xc757) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc759) {
                        // Lo       HANGUL SYLLABLE YI
                        if (0xc758 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc774) {
                          // Lo  [27] HANGUL SYLLABLE YIG..HANGUL SYLLABLE YIH
                          if (0xc759 <= code && code <= 0xc773) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE I
                          if (0xc774 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc7ac) {
                      if (code < 0xc790) {
                        // Lo  [27] HANGUL SYLLABLE IG..HANGUL SYLLABLE IH
                        if (0xc775 <= code && code <= 0xc78f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc791) {
                          // Lo       HANGUL SYLLABLE JA
                          if (0xc790 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JAG..HANGUL SYLLABLE JAH
                          if (0xc791 <= code && code <= 0xc7ab) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc7ad) {
                        // Lo       HANGUL SYLLABLE JAE
                        if (0xc7ac === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc7c8) {
                          // Lo  [27] HANGUL SYLLABLE JAEG..HANGUL SYLLABLE JAEH
                          if (0xc7ad <= code && code <= 0xc7c7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JYA
                          if (0xc7c8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xc81c) {
                    if (code < 0xc7e5) {
                      if (code < 0xc7e4) {
                        // Lo  [27] HANGUL SYLLABLE JYAG..HANGUL SYLLABLE JYAH
                        if (0xc7c9 <= code && code <= 0xc7e3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE JYAE
                        if (0xc7e4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc800) {
                        // Lo  [27] HANGUL SYLLABLE JYAEG..HANGUL SYLLABLE JYAEH
                        if (0xc7e5 <= code && code <= 0xc7ff) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc801) {
                          // Lo       HANGUL SYLLABLE JEO
                          if (0xc800 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JEOG..HANGUL SYLLABLE JEOH
                          if (0xc801 <= code && code <= 0xc81b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc839) {
                      if (code < 0xc81d) {
                        // Lo       HANGUL SYLLABLE JE
                        if (0xc81c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc838) {
                          // Lo  [27] HANGUL SYLLABLE JEG..HANGUL SYLLABLE JEH
                          if (0xc81d <= code && code <= 0xc837) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JYEO
                          if (0xc838 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc854) {
                        // Lo  [27] HANGUL SYLLABLE JYEOG..HANGUL SYLLABLE JYEOH
                        if (0xc839 <= code && code <= 0xc853) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc855) {
                          // Lo       HANGUL SYLLABLE JYE
                          if (0xc854 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JYEG..HANGUL SYLLABLE JYEH
                          if (0xc855 <= code && code <= 0xc86f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          if (code < 0xcd24) {
            if (code < 0xcabd) {
              if (code < 0xc989) {
                if (code < 0xc8fc) {
                  if (code < 0xc8a9) {
                    if (code < 0xc88c) {
                      if (code < 0xc871) {
                        // Lo       HANGUL SYLLABLE JO
                        if (0xc870 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE JOG..HANGUL SYLLABLE JOH
                        if (0xc871 <= code && code <= 0xc88b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc88d) {
                        // Lo       HANGUL SYLLABLE JWA
                        if (0xc88c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc8a8) {
                          // Lo  [27] HANGUL SYLLABLE JWAG..HANGUL SYLLABLE JWAH
                          if (0xc88d <= code && code <= 0xc8a7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JWAE
                          if (0xc8a8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc8c5) {
                      if (code < 0xc8c4) {
                        // Lo  [27] HANGUL SYLLABLE JWAEG..HANGUL SYLLABLE JWAEH
                        if (0xc8a9 <= code && code <= 0xc8c3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE JOE
                        if (0xc8c4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc8e0) {
                        // Lo  [27] HANGUL SYLLABLE JOEG..HANGUL SYLLABLE JOEH
                        if (0xc8c5 <= code && code <= 0xc8df) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc8e1) {
                          // Lo       HANGUL SYLLABLE JYO
                          if (0xc8e0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JYOG..HANGUL SYLLABLE JYOH
                          if (0xc8e1 <= code && code <= 0xc8fb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xc935) {
                    if (code < 0xc918) {
                      if (code < 0xc8fd) {
                        // Lo       HANGUL SYLLABLE JU
                        if (0xc8fc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE JUG..HANGUL SYLLABLE JUH
                        if (0xc8fd <= code && code <= 0xc917) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xc919) {
                        // Lo       HANGUL SYLLABLE JWEO
                        if (0xc918 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc934) {
                          // Lo  [27] HANGUL SYLLABLE JWEOG..HANGUL SYLLABLE JWEOH
                          if (0xc919 <= code && code <= 0xc933) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JWE
                          if (0xc934 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc96c) {
                      if (code < 0xc950) {
                        // Lo  [27] HANGUL SYLLABLE JWEG..HANGUL SYLLABLE JWEH
                        if (0xc935 <= code && code <= 0xc94f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc951) {
                          // Lo       HANGUL SYLLABLE JWI
                          if (0xc950 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JWIG..HANGUL SYLLABLE JWIH
                          if (0xc951 <= code && code <= 0xc96b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xc96d) {
                        // Lo       HANGUL SYLLABLE JYU
                        if (0xc96c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc988) {
                          // Lo  [27] HANGUL SYLLABLE JYUG..HANGUL SYLLABLE JYUH
                          if (0xc96d <= code && code <= 0xc987) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JEU
                          if (0xc988 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xca30) {
                  if (code < 0xc9dc) {
                    if (code < 0xc9a5) {
                      if (code < 0xc9a4) {
                        // Lo  [27] HANGUL SYLLABLE JEUG..HANGUL SYLLABLE JEUH
                        if (0xc989 <= code && code <= 0xc9a3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE JYI
                        if (0xc9a4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xc9c0) {
                        // Lo  [27] HANGUL SYLLABLE JYIG..HANGUL SYLLABLE JYIH
                        if (0xc9a5 <= code && code <= 0xc9bf) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xc9c1) {
                          // Lo       HANGUL SYLLABLE JI
                          if (0xc9c0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JIG..HANGUL SYLLABLE JIH
                          if (0xc9c1 <= code && code <= 0xc9db) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xc9f9) {
                      if (code < 0xc9dd) {
                        // Lo       HANGUL SYLLABLE JJA
                        if (0xc9dc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xc9f8) {
                          // Lo  [27] HANGUL SYLLABLE JJAG..HANGUL SYLLABLE JJAH
                          if (0xc9dd <= code && code <= 0xc9f7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JJAE
                          if (0xc9f8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xca14) {
                        // Lo  [27] HANGUL SYLLABLE JJAEG..HANGUL SYLLABLE JJAEH
                        if (0xc9f9 <= code && code <= 0xca13) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xca15) {
                          // Lo       HANGUL SYLLABLE JJYA
                          if (0xca14 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JJYAG..HANGUL SYLLABLE JJYAH
                          if (0xca15 <= code && code <= 0xca2f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xca69) {
                    if (code < 0xca4c) {
                      if (code < 0xca31) {
                        // Lo       HANGUL SYLLABLE JJYAE
                        if (0xca30 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE JJYAEG..HANGUL SYLLABLE JJYAEH
                        if (0xca31 <= code && code <= 0xca4b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xca4d) {
                        // Lo       HANGUL SYLLABLE JJEO
                        if (0xca4c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xca68) {
                          // Lo  [27] HANGUL SYLLABLE JJEOG..HANGUL SYLLABLE JJEOH
                          if (0xca4d <= code && code <= 0xca67) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JJE
                          if (0xca68 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcaa0) {
                      if (code < 0xca84) {
                        // Lo  [27] HANGUL SYLLABLE JJEG..HANGUL SYLLABLE JJEH
                        if (0xca69 <= code && code <= 0xca83) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xca85) {
                          // Lo       HANGUL SYLLABLE JJYEO
                          if (0xca84 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JJYEOG..HANGUL SYLLABLE JJYEOH
                          if (0xca85 <= code && code <= 0xca9f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xcaa1) {
                        // Lo       HANGUL SYLLABLE JJYE
                        if (0xcaa0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcabc) {
                          // Lo  [27] HANGUL SYLLABLE JJYEG..HANGUL SYLLABLE JJYEH
                          if (0xcaa1 <= code && code <= 0xcabb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JJO
                          if (0xcabc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xcbf0) {
                if (code < 0xcb49) {
                  if (code < 0xcb10) {
                    if (code < 0xcad9) {
                      if (code < 0xcad8) {
                        // Lo  [27] HANGUL SYLLABLE JJOG..HANGUL SYLLABLE JJOH
                        if (0xcabd <= code && code <= 0xcad7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE JJWA
                        if (0xcad8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xcaf4) {
                        // Lo  [27] HANGUL SYLLABLE JJWAG..HANGUL SYLLABLE JJWAH
                        if (0xcad9 <= code && code <= 0xcaf3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcaf5) {
                          // Lo       HANGUL SYLLABLE JJWAE
                          if (0xcaf4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JJWAEG..HANGUL SYLLABLE JJWAEH
                          if (0xcaf5 <= code && code <= 0xcb0f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcb2c) {
                      if (code < 0xcb11) {
                        // Lo       HANGUL SYLLABLE JJOE
                        if (0xcb10 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE JJOEG..HANGUL SYLLABLE JJOEH
                        if (0xcb11 <= code && code <= 0xcb2b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xcb2d) {
                        // Lo       HANGUL SYLLABLE JJYO
                        if (0xcb2c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcb48) {
                          // Lo  [27] HANGUL SYLLABLE JJYOG..HANGUL SYLLABLE JJYOH
                          if (0xcb2d <= code && code <= 0xcb47) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JJU
                          if (0xcb48 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xcb9c) {
                    if (code < 0xcb65) {
                      if (code < 0xcb64) {
                        // Lo  [27] HANGUL SYLLABLE JJUG..HANGUL SYLLABLE JJUH
                        if (0xcb49 <= code && code <= 0xcb63) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE JJWEO
                        if (0xcb64 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xcb80) {
                        // Lo  [27] HANGUL SYLLABLE JJWEOG..HANGUL SYLLABLE JJWEOH
                        if (0xcb65 <= code && code <= 0xcb7f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcb81) {
                          // Lo       HANGUL SYLLABLE JJWE
                          if (0xcb80 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JJWEG..HANGUL SYLLABLE JJWEH
                          if (0xcb81 <= code && code <= 0xcb9b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcbb9) {
                      if (code < 0xcb9d) {
                        // Lo       HANGUL SYLLABLE JJWI
                        if (0xcb9c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcbb8) {
                          // Lo  [27] HANGUL SYLLABLE JJWIG..HANGUL SYLLABLE JJWIH
                          if (0xcb9d <= code && code <= 0xcbb7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE JJYU
                          if (0xcbb8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xcbd4) {
                        // Lo  [27] HANGUL SYLLABLE JJYUG..HANGUL SYLLABLE JJYUH
                        if (0xcbb9 <= code && code <= 0xcbd3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcbd5) {
                          // Lo       HANGUL SYLLABLE JJEU
                          if (0xcbd4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE JJEUG..HANGUL SYLLABLE JJEUH
                          if (0xcbd5 <= code && code <= 0xcbef) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xcc7d) {
                  if (code < 0xcc29) {
                    if (code < 0xcc0c) {
                      if (code < 0xcbf1) {
                        // Lo       HANGUL SYLLABLE JJYI
                        if (0xcbf0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE JJYIG..HANGUL SYLLABLE JJYIH
                        if (0xcbf1 <= code && code <= 0xcc0b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xcc0d) {
                        // Lo       HANGUL SYLLABLE JJI
                        if (0xcc0c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcc28) {
                          // Lo  [27] HANGUL SYLLABLE JJIG..HANGUL SYLLABLE JJIH
                          if (0xcc0d <= code && code <= 0xcc27) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE CA
                          if (0xcc28 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcc60) {
                      if (code < 0xcc44) {
                        // Lo  [27] HANGUL SYLLABLE CAG..HANGUL SYLLABLE CAH
                        if (0xcc29 <= code && code <= 0xcc43) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcc45) {
                          // Lo       HANGUL SYLLABLE CAE
                          if (0xcc44 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE CAEG..HANGUL SYLLABLE CAEH
                          if (0xcc45 <= code && code <= 0xcc5f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xcc61) {
                        // Lo       HANGUL SYLLABLE CYA
                        if (0xcc60 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcc7c) {
                          // Lo  [27] HANGUL SYLLABLE CYAG..HANGUL SYLLABLE CYAH
                          if (0xcc61 <= code && code <= 0xcc7b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE CYAE
                          if (0xcc7c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xccd0) {
                    if (code < 0xcc99) {
                      if (code < 0xcc98) {
                        // Lo  [27] HANGUL SYLLABLE CYAEG..HANGUL SYLLABLE CYAEH
                        if (0xcc7d <= code && code <= 0xcc97) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE CEO
                        if (0xcc98 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xccb4) {
                        // Lo  [27] HANGUL SYLLABLE CEOG..HANGUL SYLLABLE CEOH
                        if (0xcc99 <= code && code <= 0xccb3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xccb5) {
                          // Lo       HANGUL SYLLABLE CE
                          if (0xccb4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE CEG..HANGUL SYLLABLE CEH
                          if (0xccb5 <= code && code <= 0xcccf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcced) {
                      if (code < 0xccd1) {
                        // Lo       HANGUL SYLLABLE CYEO
                        if (0xccd0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xccec) {
                          // Lo  [27] HANGUL SYLLABLE CYEOG..HANGUL SYLLABLE CYEOH
                          if (0xccd1 <= code && code <= 0xcceb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE CYE
                          if (0xccec === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xcd08) {
                        // Lo  [27] HANGUL SYLLABLE CYEG..HANGUL SYLLABLE CYEH
                        if (0xcced <= code && code <= 0xcd07) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcd09) {
                          // Lo       HANGUL SYLLABLE CO
                          if (0xcd08 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE COG..HANGUL SYLLABLE COH
                          if (0xcd09 <= code && code <= 0xcd23) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 0xcf71) {
              if (code < 0xce3d) {
                if (code < 0xcdb0) {
                  if (code < 0xcd5d) {
                    if (code < 0xcd40) {
                      if (code < 0xcd25) {
                        // Lo       HANGUL SYLLABLE CWA
                        if (0xcd24 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE CWAG..HANGUL SYLLABLE CWAH
                        if (0xcd25 <= code && code <= 0xcd3f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xcd41) {
                        // Lo       HANGUL SYLLABLE CWAE
                        if (0xcd40 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcd5c) {
                          // Lo  [27] HANGUL SYLLABLE CWAEG..HANGUL SYLLABLE CWAEH
                          if (0xcd41 <= code && code <= 0xcd5b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE COE
                          if (0xcd5c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcd79) {
                      if (code < 0xcd78) {
                        // Lo  [27] HANGUL SYLLABLE COEG..HANGUL SYLLABLE COEH
                        if (0xcd5d <= code && code <= 0xcd77) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE CYO
                        if (0xcd78 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xcd94) {
                        // Lo  [27] HANGUL SYLLABLE CYOG..HANGUL SYLLABLE CYOH
                        if (0xcd79 <= code && code <= 0xcd93) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcd95) {
                          // Lo       HANGUL SYLLABLE CU
                          if (0xcd94 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE CUG..HANGUL SYLLABLE CUH
                          if (0xcd95 <= code && code <= 0xcdaf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xcde9) {
                    if (code < 0xcdcc) {
                      if (code < 0xcdb1) {
                        // Lo       HANGUL SYLLABLE CWEO
                        if (0xcdb0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE CWEOG..HANGUL SYLLABLE CWEOH
                        if (0xcdb1 <= code && code <= 0xcdcb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xcdcd) {
                        // Lo       HANGUL SYLLABLE CWE
                        if (0xcdcc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcde8) {
                          // Lo  [27] HANGUL SYLLABLE CWEG..HANGUL SYLLABLE CWEH
                          if (0xcdcd <= code && code <= 0xcde7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE CWI
                          if (0xcde8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xce20) {
                      if (code < 0xce04) {
                        // Lo  [27] HANGUL SYLLABLE CWIG..HANGUL SYLLABLE CWIH
                        if (0xcde9 <= code && code <= 0xce03) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xce05) {
                          // Lo       HANGUL SYLLABLE CYU
                          if (0xce04 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE CYUG..HANGUL SYLLABLE CYUH
                          if (0xce05 <= code && code <= 0xce1f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xce21) {
                        // Lo       HANGUL SYLLABLE CEU
                        if (0xce20 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xce3c) {
                          // Lo  [27] HANGUL SYLLABLE CEUG..HANGUL SYLLABLE CEUH
                          if (0xce21 <= code && code <= 0xce3b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE CYI
                          if (0xce3c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xcee4) {
                  if (code < 0xce90) {
                    if (code < 0xce59) {
                      if (code < 0xce58) {
                        // Lo  [27] HANGUL SYLLABLE CYIG..HANGUL SYLLABLE CYIH
                        if (0xce3d <= code && code <= 0xce57) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE CI
                        if (0xce58 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xce74) {
                        // Lo  [27] HANGUL SYLLABLE CIG..HANGUL SYLLABLE CIH
                        if (0xce59 <= code && code <= 0xce73) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xce75) {
                          // Lo       HANGUL SYLLABLE KA
                          if (0xce74 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE KAG..HANGUL SYLLABLE KAH
                          if (0xce75 <= code && code <= 0xce8f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcead) {
                      if (code < 0xce91) {
                        // Lo       HANGUL SYLLABLE KAE
                        if (0xce90 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xceac) {
                          // Lo  [27] HANGUL SYLLABLE KAEG..HANGUL SYLLABLE KAEH
                          if (0xce91 <= code && code <= 0xceab) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE KYA
                          if (0xceac === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xcec8) {
                        // Lo  [27] HANGUL SYLLABLE KYAG..HANGUL SYLLABLE KYAH
                        if (0xcead <= code && code <= 0xcec7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcec9) {
                          // Lo       HANGUL SYLLABLE KYAE
                          if (0xcec8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE KYAEG..HANGUL SYLLABLE KYAEH
                          if (0xcec9 <= code && code <= 0xcee3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xcf1d) {
                    if (code < 0xcf00) {
                      if (code < 0xcee5) {
                        // Lo       HANGUL SYLLABLE KEO
                        if (0xcee4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE KEOG..HANGUL SYLLABLE KEOH
                        if (0xcee5 <= code && code <= 0xceff) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xcf01) {
                        // Lo       HANGUL SYLLABLE KE
                        if (0xcf00 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcf1c) {
                          // Lo  [27] HANGUL SYLLABLE KEG..HANGUL SYLLABLE KEH
                          if (0xcf01 <= code && code <= 0xcf1b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE KYEO
                          if (0xcf1c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcf54) {
                      if (code < 0xcf38) {
                        // Lo  [27] HANGUL SYLLABLE KYEOG..HANGUL SYLLABLE KYEOH
                        if (0xcf1d <= code && code <= 0xcf37) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcf39) {
                          // Lo       HANGUL SYLLABLE KYE
                          if (0xcf38 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE KYEG..HANGUL SYLLABLE KYEH
                          if (0xcf39 <= code && code <= 0xcf53) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xcf55) {
                        // Lo       HANGUL SYLLABLE KO
                        if (0xcf54 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcf70) {
                          // Lo  [27] HANGUL SYLLABLE KOG..HANGUL SYLLABLE KOH
                          if (0xcf55 <= code && code <= 0xcf6f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE KWA
                          if (0xcf70 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xd0a4) {
                if (code < 0xcffd) {
                  if (code < 0xcfc4) {
                    if (code < 0xcf8d) {
                      if (code < 0xcf8c) {
                        // Lo  [27] HANGUL SYLLABLE KWAG..HANGUL SYLLABLE KWAH
                        if (0xcf71 <= code && code <= 0xcf8b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE KWAE
                        if (0xcf8c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xcfa8) {
                        // Lo  [27] HANGUL SYLLABLE KWAEG..HANGUL SYLLABLE KWAEH
                        if (0xcf8d <= code && code <= 0xcfa7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xcfa9) {
                          // Lo       HANGUL SYLLABLE KOE
                          if (0xcfa8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE KOEG..HANGUL SYLLABLE KOEH
                          if (0xcfa9 <= code && code <= 0xcfc3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xcfe0) {
                      if (code < 0xcfc5) {
                        // Lo       HANGUL SYLLABLE KYO
                        if (0xcfc4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE KYOG..HANGUL SYLLABLE KYOH
                        if (0xcfc5 <= code && code <= 0xcfdf) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xcfe1) {
                        // Lo       HANGUL SYLLABLE KU
                        if (0xcfe0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xcffc) {
                          // Lo  [27] HANGUL SYLLABLE KUG..HANGUL SYLLABLE KUH
                          if (0xcfe1 <= code && code <= 0xcffb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE KWEO
                          if (0xcffc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xd050) {
                    if (code < 0xd019) {
                      if (code < 0xd018) {
                        // Lo  [27] HANGUL SYLLABLE KWEOG..HANGUL SYLLABLE KWEOH
                        if (0xcffd <= code && code <= 0xd017) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE KWE
                        if (0xd018 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd034) {
                        // Lo  [27] HANGUL SYLLABLE KWEG..HANGUL SYLLABLE KWEH
                        if (0xd019 <= code && code <= 0xd033) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd035) {
                          // Lo       HANGUL SYLLABLE KWI
                          if (0xd034 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE KWIG..HANGUL SYLLABLE KWIH
                          if (0xd035 <= code && code <= 0xd04f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd06d) {
                      if (code < 0xd051) {
                        // Lo       HANGUL SYLLABLE KYU
                        if (0xd050 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd06c) {
                          // Lo  [27] HANGUL SYLLABLE KYUG..HANGUL SYLLABLE KYUH
                          if (0xd051 <= code && code <= 0xd06b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE KEU
                          if (0xd06c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd088) {
                        // Lo  [27] HANGUL SYLLABLE KEUG..HANGUL SYLLABLE KEUH
                        if (0xd06d <= code && code <= 0xd087) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd089) {
                          // Lo       HANGUL SYLLABLE KYI
                          if (0xd088 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE KYIG..HANGUL SYLLABLE KYIH
                          if (0xd089 <= code && code <= 0xd0a3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xd131) {
                  if (code < 0xd0dd) {
                    if (code < 0xd0c0) {
                      if (code < 0xd0a5) {
                        // Lo       HANGUL SYLLABLE KI
                        if (0xd0a4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE KIG..HANGUL SYLLABLE KIH
                        if (0xd0a5 <= code && code <= 0xd0bf) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xd0c1) {
                        // Lo       HANGUL SYLLABLE TA
                        if (0xd0c0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd0dc) {
                          // Lo  [27] HANGUL SYLLABLE TAG..HANGUL SYLLABLE TAH
                          if (0xd0c1 <= code && code <= 0xd0db) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE TAE
                          if (0xd0dc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd114) {
                      if (code < 0xd0f8) {
                        // Lo  [27] HANGUL SYLLABLE TAEG..HANGUL SYLLABLE TAEH
                        if (0xd0dd <= code && code <= 0xd0f7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd0f9) {
                          // Lo       HANGUL SYLLABLE TYA
                          if (0xd0f8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE TYAG..HANGUL SYLLABLE TYAH
                          if (0xd0f9 <= code && code <= 0xd113) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd115) {
                        // Lo       HANGUL SYLLABLE TYAE
                        if (0xd114 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd130) {
                          // Lo  [27] HANGUL SYLLABLE TYAEG..HANGUL SYLLABLE TYAEH
                          if (0xd115 <= code && code <= 0xd12f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE TEO
                          if (0xd130 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xd184) {
                    if (code < 0xd14d) {
                      if (code < 0xd14c) {
                        // Lo  [27] HANGUL SYLLABLE TEOG..HANGUL SYLLABLE TEOH
                        if (0xd131 <= code && code <= 0xd14b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE TE
                        if (0xd14c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd168) {
                        // Lo  [27] HANGUL SYLLABLE TEG..HANGUL SYLLABLE TEH
                        if (0xd14d <= code && code <= 0xd167) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd169) {
                          // Lo       HANGUL SYLLABLE TYEO
                          if (0xd168 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE TYEOG..HANGUL SYLLABLE TYEOH
                          if (0xd169 <= code && code <= 0xd183) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd1a1) {
                      if (code < 0xd185) {
                        // Lo       HANGUL SYLLABLE TYE
                        if (0xd184 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd1a0) {
                          // Lo  [27] HANGUL SYLLABLE TYEG..HANGUL SYLLABLE TYEH
                          if (0xd185 <= code && code <= 0xd19f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE TO
                          if (0xd1a0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd1bc) {
                        // Lo  [27] HANGUL SYLLABLE TOG..HANGUL SYLLABLE TOH
                        if (0xd1a1 <= code && code <= 0xd1bb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd1bd) {
                          // Lo       HANGUL SYLLABLE TWA
                          if (0xd1bc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE TWAG..HANGUL SYLLABLE TWAH
                          if (0xd1bd <= code && code <= 0xd1d7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        if (code < 0x1133b) {
          if (code < 0xd671) {
            if (code < 0xd424) {
              if (code < 0xd2f1) {
                if (code < 0xd264) {
                  if (code < 0xd211) {
                    if (code < 0xd1f4) {
                      if (code < 0xd1d9) {
                        // Lo       HANGUL SYLLABLE TWAE
                        if (0xd1d8 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE TWAEG..HANGUL SYLLABLE TWAEH
                        if (0xd1d9 <= code && code <= 0xd1f3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xd1f5) {
                        // Lo       HANGUL SYLLABLE TOE
                        if (0xd1f4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd210) {
                          // Lo  [27] HANGUL SYLLABLE TOEG..HANGUL SYLLABLE TOEH
                          if (0xd1f5 <= code && code <= 0xd20f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE TYO
                          if (0xd210 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd22d) {
                      if (code < 0xd22c) {
                        // Lo  [27] HANGUL SYLLABLE TYOG..HANGUL SYLLABLE TYOH
                        if (0xd211 <= code && code <= 0xd22b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE TU
                        if (0xd22c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd248) {
                        // Lo  [27] HANGUL SYLLABLE TUG..HANGUL SYLLABLE TUH
                        if (0xd22d <= code && code <= 0xd247) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd249) {
                          // Lo       HANGUL SYLLABLE TWEO
                          if (0xd248 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE TWEOG..HANGUL SYLLABLE TWEOH
                          if (0xd249 <= code && code <= 0xd263) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xd29d) {
                    if (code < 0xd280) {
                      if (code < 0xd265) {
                        // Lo       HANGUL SYLLABLE TWE
                        if (0xd264 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE TWEG..HANGUL SYLLABLE TWEH
                        if (0xd265 <= code && code <= 0xd27f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xd281) {
                        // Lo       HANGUL SYLLABLE TWI
                        if (0xd280 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd29c) {
                          // Lo  [27] HANGUL SYLLABLE TWIG..HANGUL SYLLABLE TWIH
                          if (0xd281 <= code && code <= 0xd29b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE TYU
                          if (0xd29c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd2d4) {
                      if (code < 0xd2b8) {
                        // Lo  [27] HANGUL SYLLABLE TYUG..HANGUL SYLLABLE TYUH
                        if (0xd29d <= code && code <= 0xd2b7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd2b9) {
                          // Lo       HANGUL SYLLABLE TEU
                          if (0xd2b8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE TEUG..HANGUL SYLLABLE TEUH
                          if (0xd2b9 <= code && code <= 0xd2d3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd2d5) {
                        // Lo       HANGUL SYLLABLE TYI
                        if (0xd2d4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd2f0) {
                          // Lo  [27] HANGUL SYLLABLE TYIG..HANGUL SYLLABLE TYIH
                          if (0xd2d5 <= code && code <= 0xd2ef) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE TI
                          if (0xd2f0 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xd37d) {
                  if (code < 0xd344) {
                    if (code < 0xd30d) {
                      if (code < 0xd30c) {
                        // Lo  [27] HANGUL SYLLABLE TIG..HANGUL SYLLABLE TIH
                        if (0xd2f1 <= code && code <= 0xd30b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE PA
                        if (0xd30c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd328) {
                        // Lo  [27] HANGUL SYLLABLE PAG..HANGUL SYLLABLE PAH
                        if (0xd30d <= code && code <= 0xd327) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd329) {
                          // Lo       HANGUL SYLLABLE PAE
                          if (0xd328 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE PAEG..HANGUL SYLLABLE PAEH
                          if (0xd329 <= code && code <= 0xd343) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd360) {
                      if (code < 0xd345) {
                        // Lo       HANGUL SYLLABLE PYA
                        if (0xd344 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE PYAG..HANGUL SYLLABLE PYAH
                        if (0xd345 <= code && code <= 0xd35f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xd361) {
                        // Lo       HANGUL SYLLABLE PYAE
                        if (0xd360 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd37c) {
                          // Lo  [27] HANGUL SYLLABLE PYAEG..HANGUL SYLLABLE PYAEH
                          if (0xd361 <= code && code <= 0xd37b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE PEO
                          if (0xd37c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xd3d0) {
                    if (code < 0xd399) {
                      if (code < 0xd398) {
                        // Lo  [27] HANGUL SYLLABLE PEOG..HANGUL SYLLABLE PEOH
                        if (0xd37d <= code && code <= 0xd397) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE PE
                        if (0xd398 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd3b4) {
                        // Lo  [27] HANGUL SYLLABLE PEG..HANGUL SYLLABLE PEH
                        if (0xd399 <= code && code <= 0xd3b3) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd3b5) {
                          // Lo       HANGUL SYLLABLE PYEO
                          if (0xd3b4 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE PYEOG..HANGUL SYLLABLE PYEOH
                          if (0xd3b5 <= code && code <= 0xd3cf) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd3ed) {
                      if (code < 0xd3d1) {
                        // Lo       HANGUL SYLLABLE PYE
                        if (0xd3d0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd3ec) {
                          // Lo  [27] HANGUL SYLLABLE PYEG..HANGUL SYLLABLE PYEH
                          if (0xd3d1 <= code && code <= 0xd3eb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE PO
                          if (0xd3ec === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd408) {
                        // Lo  [27] HANGUL SYLLABLE POG..HANGUL SYLLABLE POH
                        if (0xd3ed <= code && code <= 0xd407) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd409) {
                          // Lo       HANGUL SYLLABLE PWA
                          if (0xd408 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE PWAG..HANGUL SYLLABLE PWAH
                          if (0xd409 <= code && code <= 0xd423) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0xd53d) {
                if (code < 0xd4b0) {
                  if (code < 0xd45d) {
                    if (code < 0xd440) {
                      if (code < 0xd425) {
                        // Lo       HANGUL SYLLABLE PWAE
                        if (0xd424 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE PWAEG..HANGUL SYLLABLE PWAEH
                        if (0xd425 <= code && code <= 0xd43f) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xd441) {
                        // Lo       HANGUL SYLLABLE POE
                        if (0xd440 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd45c) {
                          // Lo  [27] HANGUL SYLLABLE POEG..HANGUL SYLLABLE POEH
                          if (0xd441 <= code && code <= 0xd45b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE PYO
                          if (0xd45c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd479) {
                      if (code < 0xd478) {
                        // Lo  [27] HANGUL SYLLABLE PYOG..HANGUL SYLLABLE PYOH
                        if (0xd45d <= code && code <= 0xd477) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE PU
                        if (0xd478 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd494) {
                        // Lo  [27] HANGUL SYLLABLE PUG..HANGUL SYLLABLE PUH
                        if (0xd479 <= code && code <= 0xd493) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd495) {
                          // Lo       HANGUL SYLLABLE PWEO
                          if (0xd494 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE PWEOG..HANGUL SYLLABLE PWEOH
                          if (0xd495 <= code && code <= 0xd4af) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xd4e9) {
                    if (code < 0xd4cc) {
                      if (code < 0xd4b1) {
                        // Lo       HANGUL SYLLABLE PWE
                        if (0xd4b0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE PWEG..HANGUL SYLLABLE PWEH
                        if (0xd4b1 <= code && code <= 0xd4cb) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xd4cd) {
                        // Lo       HANGUL SYLLABLE PWI
                        if (0xd4cc === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd4e8) {
                          // Lo  [27] HANGUL SYLLABLE PWIG..HANGUL SYLLABLE PWIH
                          if (0xd4cd <= code && code <= 0xd4e7) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE PYU
                          if (0xd4e8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd520) {
                      if (code < 0xd504) {
                        // Lo  [27] HANGUL SYLLABLE PYUG..HANGUL SYLLABLE PYUH
                        if (0xd4e9 <= code && code <= 0xd503) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd505) {
                          // Lo       HANGUL SYLLABLE PEU
                          if (0xd504 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE PEUG..HANGUL SYLLABLE PEUH
                          if (0xd505 <= code && code <= 0xd51f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd521) {
                        // Lo       HANGUL SYLLABLE PYI
                        if (0xd520 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd53c) {
                          // Lo  [27] HANGUL SYLLABLE PYIG..HANGUL SYLLABLE PYIH
                          if (0xd521 <= code && code <= 0xd53b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE PI
                          if (0xd53c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0xd5e4) {
                  if (code < 0xd590) {
                    if (code < 0xd559) {
                      if (code < 0xd558) {
                        // Lo  [27] HANGUL SYLLABLE PIG..HANGUL SYLLABLE PIH
                        if (0xd53d <= code && code <= 0xd557) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE HA
                        if (0xd558 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd574) {
                        // Lo  [27] HANGUL SYLLABLE HAG..HANGUL SYLLABLE HAH
                        if (0xd559 <= code && code <= 0xd573) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd575) {
                          // Lo       HANGUL SYLLABLE HAE
                          if (0xd574 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE HAEG..HANGUL SYLLABLE HAEH
                          if (0xd575 <= code && code <= 0xd58f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd5ad) {
                      if (code < 0xd591) {
                        // Lo       HANGUL SYLLABLE HYA
                        if (0xd590 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd5ac) {
                          // Lo  [27] HANGUL SYLLABLE HYAG..HANGUL SYLLABLE HYAH
                          if (0xd591 <= code && code <= 0xd5ab) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE HYAE
                          if (0xd5ac === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd5c8) {
                        // Lo  [27] HANGUL SYLLABLE HYAEG..HANGUL SYLLABLE HYAEH
                        if (0xd5ad <= code && code <= 0xd5c7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd5c9) {
                          // Lo       HANGUL SYLLABLE HEO
                          if (0xd5c8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE HEOG..HANGUL SYLLABLE HEOH
                          if (0xd5c9 <= code && code <= 0xd5e3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xd61d) {
                    if (code < 0xd600) {
                      if (code < 0xd5e5) {
                        // Lo       HANGUL SYLLABLE HE
                        if (0xd5e4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE HEG..HANGUL SYLLABLE HEH
                        if (0xd5e5 <= code && code <= 0xd5ff) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xd601) {
                        // Lo       HANGUL SYLLABLE HYEO
                        if (0xd600 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd61c) {
                          // Lo  [27] HANGUL SYLLABLE HYEOG..HANGUL SYLLABLE HYEOH
                          if (0xd601 <= code && code <= 0xd61b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE HYE
                          if (0xd61c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd654) {
                      if (code < 0xd638) {
                        // Lo  [27] HANGUL SYLLABLE HYEG..HANGUL SYLLABLE HYEH
                        if (0xd61d <= code && code <= 0xd637) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd639) {
                          // Lo       HANGUL SYLLABLE HO
                          if (0xd638 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE HOG..HANGUL SYLLABLE HOH
                          if (0xd639 <= code && code <= 0xd653) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd655) {
                        // Lo       HANGUL SYLLABLE HWA
                        if (0xd654 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd670) {
                          // Lo  [27] HANGUL SYLLABLE HWAG..HANGUL SYLLABLE HWAH
                          if (0xd655 <= code && code <= 0xd66f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE HWAE
                          if (0xd670 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 0x11000) {
              if (code < 0xd7b0) {
                if (code < 0xd6fd) {
                  if (code < 0xd6c4) {
                    if (code < 0xd68d) {
                      if (code < 0xd68c) {
                        // Lo  [27] HANGUL SYLLABLE HWAEG..HANGUL SYLLABLE HWAEH
                        if (0xd671 <= code && code <= 0xd68b) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE HOE
                        if (0xd68c === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd6a8) {
                        // Lo  [27] HANGUL SYLLABLE HOEG..HANGUL SYLLABLE HOEH
                        if (0xd68d <= code && code <= 0xd6a7) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd6a9) {
                          // Lo       HANGUL SYLLABLE HYO
                          if (0xd6a8 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE HYOG..HANGUL SYLLABLE HYOH
                          if (0xd6a9 <= code && code <= 0xd6c3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd6e0) {
                      if (code < 0xd6c5) {
                        // Lo       HANGUL SYLLABLE HU
                        if (0xd6c4 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        // Lo  [27] HANGUL SYLLABLE HUG..HANGUL SYLLABLE HUH
                        if (0xd6c5 <= code && code <= 0xd6df) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      }
                    } else {
                      if (code < 0xd6e1) {
                        // Lo       HANGUL SYLLABLE HWEO
                        if (0xd6e0 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd6fc) {
                          // Lo  [27] HANGUL SYLLABLE HWEOG..HANGUL SYLLABLE HWEOH
                          if (0xd6e1 <= code && code <= 0xd6fb) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE HWE
                          if (0xd6fc === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0xd750) {
                    if (code < 0xd719) {
                      if (code < 0xd718) {
                        // Lo  [27] HANGUL SYLLABLE HWEG..HANGUL SYLLABLE HWEH
                        if (0xd6fd <= code && code <= 0xd717) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        // Lo       HANGUL SYLLABLE HWI
                        if (0xd718 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      }
                    } else {
                      if (code < 0xd734) {
                        // Lo  [27] HANGUL SYLLABLE HWIG..HANGUL SYLLABLE HWIH
                        if (0xd719 <= code && code <= 0xd733) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd735) {
                          // Lo       HANGUL SYLLABLE HYU
                          if (0xd734 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE HYUG..HANGUL SYLLABLE HYUH
                          if (0xd735 <= code && code <= 0xd74f) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xd76d) {
                      if (code < 0xd751) {
                        // Lo       HANGUL SYLLABLE HEU
                        if (0xd750 === code) {
                          return boundaries_1.CLUSTER_BREAK.LV;
                        }
                      } else {
                        if (code < 0xd76c) {
                          // Lo  [27] HANGUL SYLLABLE HEUG..HANGUL SYLLABLE HEUH
                          if (0xd751 <= code && code <= 0xd76b) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        } else {
                          // Lo       HANGUL SYLLABLE HYI
                          if (0xd76c === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        }
                      }
                    } else {
                      if (code < 0xd788) {
                        // Lo  [27] HANGUL SYLLABLE HYIG..HANGUL SYLLABLE HYIH
                        if (0xd76d <= code && code <= 0xd787) {
                          return boundaries_1.CLUSTER_BREAK.LVT;
                        }
                      } else {
                        if (code < 0xd789) {
                          // Lo       HANGUL SYLLABLE HI
                          if (0xd788 === code) {
                            return boundaries_1.CLUSTER_BREAK.LV;
                          }
                        } else {
                          // Lo  [27] HANGUL SYLLABLE HIG..HANGUL SYLLABLE HIH
                          if (0xd789 <= code && code <= 0xd7a3) {
                            return boundaries_1.CLUSTER_BREAK.LVT;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x10a01) {
                  if (code < 0xfeff) {
                    if (code < 0xfb1e) {
                      if (code < 0xd7cb) {
                        // Lo  [23] HANGUL JUNGSEONG O-YEO..HANGUL JUNGSEONG ARAEA-E
                        if (0xd7b0 <= code && code <= 0xd7c6) {
                          return boundaries_1.CLUSTER_BREAK.V;
                        }
                      } else {
                        // Lo  [49] HANGUL JONGSEONG NIEUN-RIEUL..HANGUL JONGSEONG PHIEUPH-THIEUTH
                        if (0xd7cb <= code && code <= 0xd7fb) {
                          return boundaries_1.CLUSTER_BREAK.T;
                        }
                      }
                    } else {
                      if (code < 0xfe00) {
                        // Mn       HEBREW POINT JUDEO-SPANISH VARIKA
                        if (0xfb1e === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xfe20) {
                          // Mn  [16] VARIATION SELECTOR-1..VARIATION SELECTOR-16
                          if (0xfe00 <= code && code <= 0xfe0f) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn  [16] COMBINING LIGATURE LEFT HALF..COMBINING CYRILLIC TITLO RIGHT HALF
                          if (0xfe20 <= code && code <= 0xfe2f) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x101fd) {
                      if (code < 0xff9e) {
                        // Cf       ZERO WIDTH NO-BREAK SPACE
                        if (0xfeff === code) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      } else {
                        if (code < 0xfff0) {
                          // Lm   [2] HALFWIDTH KATAKANA VOICED SOUND MARK..HALFWIDTH KATAKANA SEMI-VOICED SOUND MARK
                          if (0xff9e <= code && code <= 0xff9f) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Cn   [9] <reserved-FFF0>..<reserved-FFF8>
                          // Cf   [3] INTERLINEAR ANNOTATION ANCHOR..INTERLINEAR ANNOTATION TERMINATOR
                          if (0xfff0 <= code && code <= 0xfffb) {
                            return boundaries_1.CLUSTER_BREAK.CONTROL;
                          }
                        }
                      }
                    } else {
                      if (code < 0x102e0) {
                        // Mn       PHAISTOS DISC SIGN COMBINING OBLIQUE STROKE
                        if (0x101fd === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x10376) {
                          // Mn       COPTIC EPACT THOUSANDS MARK
                          if (0x102e0 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [5] COMBINING OLD PERMIC LETTER AN..COMBINING OLD PERMIC LETTER SII
                          if (0x10376 <= code && code <= 0x1037a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x10ae5) {
                    if (code < 0x10a0c) {
                      if (code < 0x10a05) {
                        // Mn   [3] KHAROSHTHI VOWEL SIGN I..KHAROSHTHI VOWEL SIGN VOCALIC R
                        if (0x10a01 <= code && code <= 0x10a03) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [2] KHAROSHTHI VOWEL SIGN E..KHAROSHTHI VOWEL SIGN O
                        if (0x10a05 <= code && code <= 0x10a06) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x10a38) {
                        // Mn   [4] KHAROSHTHI VOWEL LENGTH MARK..KHAROSHTHI SIGN VISARGA
                        if (0x10a0c <= code && code <= 0x10a0f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x10a3f) {
                          // Mn   [3] KHAROSHTHI SIGN BAR ABOVE..KHAROSHTHI SIGN DOT BELOW
                          if (0x10a38 <= code && code <= 0x10a3a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       KHAROSHTHI VIRAMA
                          if (0x10a3f === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x10efd) {
                      if (code < 0x10d24) {
                        // Mn   [2] MANICHAEAN ABBREVIATION MARK ABOVE..MANICHAEAN ABBREVIATION MARK BELOW
                        if (0x10ae5 <= code && code <= 0x10ae6) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x10eab) {
                          // Mn   [4] HANIFI ROHINGYA SIGN HARBAHAY..HANIFI ROHINGYA SIGN TASSI
                          if (0x10d24 <= code && code <= 0x10d27) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] YEZIDI COMBINING HAMZA MARK..YEZIDI COMBINING MADDA MARK
                          if (0x10eab <= code && code <= 0x10eac) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x10f46) {
                        // Mn   [3] ARABIC SMALL LOW WORD SAKTA..ARABIC SMALL LOW WORD MADDA
                        if (0x10efd <= code && code <= 0x10eff) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x10f82) {
                          // Mn  [11] SOGDIAN COMBINING DOT BELOW..SOGDIAN COMBINING STROKE BELOW
                          if (0x10f46 <= code && code <= 0x10f50) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [4] OLD UYGHUR COMBINING DOT ABOVE..OLD UYGHUR COMBINING TWO DOTS BELOW
                          if (0x10f82 <= code && code <= 0x10f85) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0x11180) {
                if (code < 0x110b7) {
                  if (code < 0x11073) {
                    if (code < 0x11002) {
                      // Mc       BRAHMI SIGN CANDRABINDU
                      if (0x11000 === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                      // Mn       BRAHMI SIGN ANUSVARA
                      if (0x11001 === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0x11038) {
                        // Mc       BRAHMI SIGN VISARGA
                        if (0x11002 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x11070) {
                          // Mn  [15] BRAHMI VOWEL SIGN AA..BRAHMI VIRAMA
                          if (0x11038 <= code && code <= 0x11046) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       BRAHMI SIGN OLD TAMIL VIRAMA
                          if (0x11070 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x11082) {
                      if (code < 0x1107f) {
                        // Mn   [2] BRAHMI VOWEL SIGN OLD TAMIL SHORT E..BRAHMI VOWEL SIGN OLD TAMIL SHORT O
                        if (0x11073 <= code && code <= 0x11074) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [3] BRAHMI NUMBER JOINER..KAITHI SIGN ANUSVARA
                        if (0x1107f <= code && code <= 0x11081) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x110b0) {
                        // Mc       KAITHI SIGN VISARGA
                        if (0x11082 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x110b3) {
                          // Mc   [3] KAITHI VOWEL SIGN AA..KAITHI VOWEL SIGN II
                          if (0x110b0 <= code && code <= 0x110b2) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [4] KAITHI VOWEL SIGN U..KAITHI VOWEL SIGN AI
                          if (0x110b3 <= code && code <= 0x110b6) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x11100) {
                    if (code < 0x110bd) {
                      if (code < 0x110b9) {
                        // Mc   [2] KAITHI VOWEL SIGN O..KAITHI VOWEL SIGN AU
                        if (0x110b7 <= code && code <= 0x110b8) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [2] KAITHI SIGN VIRAMA..KAITHI SIGN NUKTA
                        if (0x110b9 <= code && code <= 0x110ba) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x110c2) {
                        // Cf       KAITHI NUMBER SIGN
                        if (0x110bd === code) {
                          return boundaries_1.CLUSTER_BREAK.PREPEND;
                        }
                      } else {
                        // Mn       KAITHI VOWEL SIGN VOCALIC R
                        if (0x110c2 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Cf       KAITHI NUMBER SIGN ABOVE
                        if (0x110cd === code) {
                          return boundaries_1.CLUSTER_BREAK.PREPEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0x1112d) {
                      if (code < 0x11127) {
                        // Mn   [3] CHAKMA SIGN CANDRABINDU..CHAKMA SIGN VISARGA
                        if (0x11100 <= code && code <= 0x11102) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1112c) {
                          // Mn   [5] CHAKMA VOWEL SIGN A..CHAKMA VOWEL SIGN UU
                          if (0x11127 <= code && code <= 0x1112b) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc       CHAKMA VOWEL SIGN E
                          if (0x1112c === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0x11145) {
                        // Mn   [8] CHAKMA VOWEL SIGN AI..CHAKMA MAAYYAA
                        if (0x1112d <= code && code <= 0x11134) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11173) {
                          // Mc   [2] CHAKMA VOWEL SIGN AA..CHAKMA VOWEL SIGN EI
                          if (0x11145 <= code && code <= 0x11146) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn       MAHAJANI SIGN NUKTA
                          if (0x11173 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x11232) {
                  if (code < 0x111c2) {
                    if (code < 0x111b3) {
                      if (code < 0x11182) {
                        // Mn   [2] SHARADA SIGN CANDRABINDU..SHARADA SIGN ANUSVARA
                        if (0x11180 <= code && code <= 0x11181) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       SHARADA SIGN VISARGA
                        if (0x11182 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x111b6) {
                        // Mc   [3] SHARADA VOWEL SIGN AA..SHARADA VOWEL SIGN II
                        if (0x111b3 <= code && code <= 0x111b5) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x111bf) {
                          // Mn   [9] SHARADA VOWEL SIGN U..SHARADA VOWEL SIGN O
                          if (0x111b6 <= code && code <= 0x111be) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] SHARADA VOWEL SIGN AU..SHARADA SIGN VIRAMA
                          if (0x111bf <= code && code <= 0x111c0) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x111cf) {
                      if (code < 0x111c9) {
                        // Lo   [2] SHARADA SIGN JIHVAMULIYA..SHARADA SIGN UPADHMANIYA
                        if (0x111c2 <= code && code <= 0x111c3) {
                          return boundaries_1.CLUSTER_BREAK.PREPEND;
                        }
                      } else {
                        if (code < 0x111ce) {
                          // Mn   [4] SHARADA SANDHI MARK..SHARADA EXTRA SHORT VOWEL MARK
                          if (0x111c9 <= code && code <= 0x111cc) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc       SHARADA VOWEL SIGN PRISHTHAMATRA E
                          if (0x111ce === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1122c) {
                        // Mn       SHARADA SIGN INVERTED CANDRABINDU
                        if (0x111cf === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1122f) {
                          // Mc   [3] KHOJKI VOWEL SIGN AA..KHOJKI VOWEL SIGN II
                          if (0x1122c <= code && code <= 0x1122e) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [3] KHOJKI VOWEL SIGN U..KHOJKI VOWEL SIGN AI
                          if (0x1122f <= code && code <= 0x11231) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x11241) {
                    if (code < 0x11235) {
                      if (code < 0x11234) {
                        // Mc   [2] KHOJKI VOWEL SIGN O..KHOJKI VOWEL SIGN AU
                        if (0x11232 <= code && code <= 0x11233) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       KHOJKI SIGN ANUSVARA
                        if (0x11234 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x11236) {
                        // Mc       KHOJKI SIGN VIRAMA
                        if (0x11235 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x1123e) {
                          // Mn   [2] KHOJKI SIGN NUKTA..KHOJKI SIGN SHADDA
                          if (0x11236 <= code && code <= 0x11237) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       KHOJKI SIGN SUKUN
                          if (0x1123e === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x112e3) {
                      if (code < 0x112df) {
                        // Mn       KHOJKI VOWEL SIGN VOCALIC R
                        if (0x11241 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x112e0) {
                          // Mn       KHUDAWADI SIGN ANUSVARA
                          if (0x112df === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [3] KHUDAWADI VOWEL SIGN AA..KHUDAWADI VOWEL SIGN II
                          if (0x112e0 <= code && code <= 0x112e2) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0x11300) {
                        // Mn   [8] KHUDAWADI VOWEL SIGN U..KHUDAWADI SIGN VIRAMA
                        if (0x112e3 <= code && code <= 0x112ea) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11302) {
                          // Mn   [2] GRANTHA SIGN COMBINING ANUSVARA ABOVE..GRANTHA SIGN CANDRABINDU
                          if (0x11300 <= code && code <= 0x11301) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] GRANTHA SIGN ANUSVARA..GRANTHA SIGN VISARGA
                          if (0x11302 <= code && code <= 0x11303) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          if (code < 0x11a97) {
            if (code < 0x116ab) {
              if (code < 0x114b9) {
                if (code < 0x11370) {
                  if (code < 0x11347) {
                    if (code < 0x1133f) {
                      if (code < 0x1133e) {
                        // Mn   [2] COMBINING BINDU BELOW..GRANTHA SIGN NUKTA
                        if (0x1133b <= code && code <= 0x1133c) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       GRANTHA VOWEL SIGN AA
                        if (0x1133e === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x11340) {
                        // Mc       GRANTHA VOWEL SIGN I
                        if (0x1133f === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x11341) {
                          // Mn       GRANTHA VOWEL SIGN II
                          if (0x11340 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [4] GRANTHA VOWEL SIGN U..GRANTHA VOWEL SIGN VOCALIC RR
                          if (0x11341 <= code && code <= 0x11344) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x11357) {
                      if (code < 0x1134b) {
                        // Mc   [2] GRANTHA VOWEL SIGN EE..GRANTHA VOWEL SIGN AI
                        if (0x11347 <= code && code <= 0x11348) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mc   [3] GRANTHA VOWEL SIGN OO..GRANTHA SIGN VIRAMA
                        if (0x1134b <= code && code <= 0x1134d) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x11362) {
                        // Mc       GRANTHA AU LENGTH MARK
                        if (0x11357 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11366) {
                          // Mc   [2] GRANTHA VOWEL SIGN VOCALIC L..GRANTHA VOWEL SIGN VOCALIC LL
                          if (0x11362 <= code && code <= 0x11363) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [7] COMBINING GRANTHA DIGIT ZERO..COMBINING GRANTHA DIGIT SIX
                          if (0x11366 <= code && code <= 0x1136c) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x11445) {
                    if (code < 0x11438) {
                      if (code < 0x11435) {
                        // Mn   [5] COMBINING GRANTHA LETTER A..COMBINING GRANTHA LETTER PA
                        if (0x11370 <= code && code <= 0x11374) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc   [3] NEWA VOWEL SIGN AA..NEWA VOWEL SIGN II
                        if (0x11435 <= code && code <= 0x11437) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x11440) {
                        // Mn   [8] NEWA VOWEL SIGN U..NEWA VOWEL SIGN AI
                        if (0x11438 <= code && code <= 0x1143f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11442) {
                          // Mc   [2] NEWA VOWEL SIGN O..NEWA VOWEL SIGN AU
                          if (0x11440 <= code && code <= 0x11441) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [3] NEWA SIGN VIRAMA..NEWA SIGN ANUSVARA
                          if (0x11442 <= code && code <= 0x11444) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x114b0) {
                      if (code < 0x11446) {
                        // Mc       NEWA SIGN VISARGA
                        if (0x11445 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       NEWA SIGN NUKTA
                        if (0x11446 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mn       NEWA SANDHI MARK
                        if (0x1145e === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x114b1) {
                        // Mc       TIRHUTA VOWEL SIGN AA
                        if (0x114b0 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x114b3) {
                          // Mc   [2] TIRHUTA VOWEL SIGN I..TIRHUTA VOWEL SIGN II
                          if (0x114b1 <= code && code <= 0x114b2) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [6] TIRHUTA VOWEL SIGN U..TIRHUTA VOWEL SIGN VOCALIC LL
                          if (0x114b3 <= code && code <= 0x114b8) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x115b8) {
                  if (code < 0x114bf) {
                    if (code < 0x114bb) {
                      // Mc       TIRHUTA VOWEL SIGN E
                      if (0x114b9 === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                      // Mn       TIRHUTA VOWEL SIGN SHORT E
                      if (0x114ba === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0x114bd) {
                        // Mc   [2] TIRHUTA VOWEL SIGN AI..TIRHUTA VOWEL SIGN O
                        if (0x114bb <= code && code <= 0x114bc) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mc       TIRHUTA VOWEL SIGN SHORT O
                        if (0x114bd === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mc       TIRHUTA VOWEL SIGN AU
                        if (0x114be === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    }
                  } else {
                    if (code < 0x115af) {
                      if (code < 0x114c1) {
                        // Mn   [2] TIRHUTA SIGN CANDRABINDU..TIRHUTA SIGN ANUSVARA
                        if (0x114bf <= code && code <= 0x114c0) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x114c2) {
                          // Mc       TIRHUTA SIGN VISARGA
                          if (0x114c1 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [2] TIRHUTA SIGN VIRAMA..TIRHUTA SIGN NUKTA
                          if (0x114c2 <= code && code <= 0x114c3) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x115b0) {
                        // Mc       SIDDHAM VOWEL SIGN AA
                        if (0x115af === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x115b2) {
                          // Mc   [2] SIDDHAM VOWEL SIGN I..SIDDHAM VOWEL SIGN II
                          if (0x115b0 <= code && code <= 0x115b1) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [4] SIDDHAM VOWEL SIGN U..SIDDHAM VOWEL SIGN VOCALIC RR
                          if (0x115b2 <= code && code <= 0x115b5) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x11630) {
                    if (code < 0x115be) {
                      if (code < 0x115bc) {
                        // Mc   [4] SIDDHAM VOWEL SIGN E..SIDDHAM VOWEL SIGN AU
                        if (0x115b8 <= code && code <= 0x115bb) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [2] SIDDHAM SIGN CANDRABINDU..SIDDHAM SIGN ANUSVARA
                        if (0x115bc <= code && code <= 0x115bd) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x115bf) {
                        // Mc       SIDDHAM SIGN VISARGA
                        if (0x115be === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x115dc) {
                          // Mn   [2] SIDDHAM SIGN VIRAMA..SIDDHAM SIGN NUKTA
                          if (0x115bf <= code && code <= 0x115c0) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] SIDDHAM VOWEL SIGN ALTERNATE U..SIDDHAM VOWEL SIGN ALTERNATE UU
                          if (0x115dc <= code && code <= 0x115dd) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1163d) {
                      if (code < 0x11633) {
                        // Mc   [3] MODI VOWEL SIGN AA..MODI VOWEL SIGN II
                        if (0x11630 <= code && code <= 0x11632) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x1163b) {
                          // Mn   [8] MODI VOWEL SIGN U..MODI VOWEL SIGN AI
                          if (0x11633 <= code && code <= 0x1163a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] MODI VOWEL SIGN O..MODI VOWEL SIGN AU
                          if (0x1163b <= code && code <= 0x1163c) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1163e) {
                        // Mn       MODI SIGN ANUSVARA
                        if (0x1163d === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1163f) {
                          // Mc       MODI SIGN VISARGA
                          if (0x1163e === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [2] MODI SIGN VIRAMA..MODI SIGN ARDHACANDRA
                          if (0x1163f <= code && code <= 0x11640) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0x1193f) {
                if (code < 0x11727) {
                  if (code < 0x116b6) {
                    if (code < 0x116ad) {
                      // Mn       TAKRI SIGN ANUSVARA
                      if (0x116ab === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                      // Mc       TAKRI SIGN VISARGA
                      if (0x116ac === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                    } else {
                      if (code < 0x116ae) {
                        // Mn       TAKRI VOWEL SIGN AA
                        if (0x116ad === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x116b0) {
                          // Mc   [2] TAKRI VOWEL SIGN I..TAKRI VOWEL SIGN II
                          if (0x116ae <= code && code <= 0x116af) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [6] TAKRI VOWEL SIGN U..TAKRI VOWEL SIGN AU
                          if (0x116b0 <= code && code <= 0x116b5) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1171d) {
                      // Mc       TAKRI SIGN VIRAMA
                      if (0x116b6 === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                      // Mn       TAKRI SIGN NUKTA
                      if (0x116b7 === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0x11722) {
                        // Mn   [3] AHOM CONSONANT SIGN MEDIAL LA..AHOM CONSONANT SIGN MEDIAL LIGATING RA
                        if (0x1171d <= code && code <= 0x1171f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11726) {
                          // Mn   [4] AHOM VOWEL SIGN I..AHOM VOWEL SIGN UU
                          if (0x11722 <= code && code <= 0x11725) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc       AHOM VOWEL SIGN E
                          if (0x11726 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x11930) {
                    if (code < 0x1182f) {
                      if (code < 0x1182c) {
                        // Mn   [5] AHOM VOWEL SIGN AW..AHOM SIGN KILLER
                        if (0x11727 <= code && code <= 0x1172b) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc   [3] DOGRA VOWEL SIGN AA..DOGRA VOWEL SIGN II
                        if (0x1182c <= code && code <= 0x1182e) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x11838) {
                        // Mn   [9] DOGRA VOWEL SIGN U..DOGRA SIGN ANUSVARA
                        if (0x1182f <= code && code <= 0x11837) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11839) {
                          // Mc       DOGRA SIGN VISARGA
                          if (0x11838 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [2] DOGRA SIGN VIRAMA..DOGRA SIGN NUKTA
                          if (0x11839 <= code && code <= 0x1183a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1193b) {
                      if (code < 0x11931) {
                        // Mc       DIVES AKURU VOWEL SIGN AA
                        if (0x11930 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11937) {
                          // Mc   [5] DIVES AKURU VOWEL SIGN I..DIVES AKURU VOWEL SIGN E
                          if (0x11931 <= code && code <= 0x11935) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mc   [2] DIVES AKURU VOWEL SIGN AI..DIVES AKURU VOWEL SIGN O
                          if (0x11937 <= code && code <= 0x11938) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1193d) {
                        // Mn   [2] DIVES AKURU SIGN ANUSVARA..DIVES AKURU SIGN CANDRABINDU
                        if (0x1193b <= code && code <= 0x1193c) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       DIVES AKURU SIGN HALANTA
                        if (0x1193d === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                        // Mn       DIVES AKURU VIRAMA
                        if (0x1193e === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x11a01) {
                  if (code < 0x119d1) {
                    if (code < 0x11941) {
                      // Lo       DIVES AKURU PREFIXED NASAL SIGN
                      if (0x1193f === code) {
                        return boundaries_1.CLUSTER_BREAK.PREPEND;
                      }
                      // Mc       DIVES AKURU MEDIAL YA
                      if (0x11940 === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                    } else {
                      if (code < 0x11942) {
                        // Lo       DIVES AKURU INITIAL RA
                        if (0x11941 === code) {
                          return boundaries_1.CLUSTER_BREAK.PREPEND;
                        }
                      } else {
                        // Mc       DIVES AKURU MEDIAL RA
                        if (0x11942 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                        // Mn       DIVES AKURU SIGN NUKTA
                        if (0x11943 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0x119dc) {
                      if (code < 0x119d4) {
                        // Mc   [3] NANDINAGARI VOWEL SIGN AA..NANDINAGARI VOWEL SIGN II
                        if (0x119d1 <= code && code <= 0x119d3) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x119da) {
                          // Mn   [4] NANDINAGARI VOWEL SIGN U..NANDINAGARI VOWEL SIGN VOCALIC RR
                          if (0x119d4 <= code && code <= 0x119d7) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [2] NANDINAGARI VOWEL SIGN E..NANDINAGARI VOWEL SIGN AI
                          if (0x119da <= code && code <= 0x119db) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x119e0) {
                        // Mc   [4] NANDINAGARI VOWEL SIGN O..NANDINAGARI SIGN VISARGA
                        if (0x119dc <= code && code <= 0x119df) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn       NANDINAGARI SIGN VIRAMA
                        if (0x119e0 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mc       NANDINAGARI VOWEL SIGN PRISHTHAMATRA E
                        if (0x119e4 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x11a47) {
                    if (code < 0x11a39) {
                      if (code < 0x11a33) {
                        // Mn  [10] ZANABAZAR SQUARE VOWEL SIGN I..ZANABAZAR SQUARE VOWEL LENGTH MARK
                        if (0x11a01 <= code && code <= 0x11a0a) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [6] ZANABAZAR SQUARE FINAL CONSONANT MARK..ZANABAZAR SQUARE SIGN ANUSVARA
                        if (0x11a33 <= code && code <= 0x11a38) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x11a3a) {
                        // Mc       ZANABAZAR SQUARE SIGN VISARGA
                        if (0x11a39 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x11a3b) {
                          // Lo       ZANABAZAR SQUARE CLUSTER-INITIAL LETTER RA
                          if (0x11a3a === code) {
                            return boundaries_1.CLUSTER_BREAK.PREPEND;
                          }
                        } else {
                          // Mn   [4] ZANABAZAR SQUARE CLUSTER-FINAL LETTER YA..ZANABAZAR SQUARE CLUSTER-FINAL LETTER VA
                          if (0x11a3b <= code && code <= 0x11a3e) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x11a59) {
                      if (code < 0x11a51) {
                        // Mn       ZANABAZAR SQUARE SUBJOINER
                        if (0x11a47 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11a57) {
                          // Mn   [6] SOYOMBO VOWEL SIGN I..SOYOMBO VOWEL SIGN OE
                          if (0x11a51 <= code && code <= 0x11a56) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [2] SOYOMBO VOWEL SIGN AI..SOYOMBO VOWEL SIGN AU
                          if (0x11a57 <= code && code <= 0x11a58) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    } else {
                      if (code < 0x11a84) {
                        // Mn   [3] SOYOMBO VOWEL SIGN VOCALIC R..SOYOMBO VOWEL LENGTH MARK
                        if (0x11a59 <= code && code <= 0x11a5b) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11a8a) {
                          // Lo   [6] SOYOMBO SIGN JIHVAMULIYA..SOYOMBO CLUSTER-INITIAL LETTER SA
                          if (0x11a84 <= code && code <= 0x11a89) {
                            return boundaries_1.CLUSTER_BREAK.PREPEND;
                          }
                        } else {
                          // Mn  [13] SOYOMBO FINAL CONSONANT SIGN G..SOYOMBO SIGN ANUSVARA
                          if (0x11a8a <= code && code <= 0x11a96) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            if (code < 0x16f51) {
              if (code < 0x11d90) {
                if (code < 0x11cb1) {
                  if (code < 0x11c3e) {
                    if (code < 0x11c2f) {
                      if (code < 0x11a98) {
                        // Mc       SOYOMBO SIGN VISARGA
                        if (0x11a97 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [2] SOYOMBO GEMINATION MARK..SOYOMBO SUBJOINER
                        if (0x11a98 <= code && code <= 0x11a99) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x11c30) {
                        // Mc       BHAIKSUKI VOWEL SIGN AA
                        if (0x11c2f === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x11c38) {
                          // Mn   [7] BHAIKSUKI VOWEL SIGN I..BHAIKSUKI VOWEL SIGN VOCALIC L
                          if (0x11c30 <= code && code <= 0x11c36) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [6] BHAIKSUKI VOWEL SIGN E..BHAIKSUKI SIGN ANUSVARA
                          if (0x11c38 <= code && code <= 0x11c3d) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x11c92) {
                      // Mc       BHAIKSUKI SIGN VISARGA
                      if (0x11c3e === code) {
                        return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                      }
                      // Mn       BHAIKSUKI SIGN VIRAMA
                      if (0x11c3f === code) {
                        return boundaries_1.CLUSTER_BREAK.EXTEND;
                      }
                    } else {
                      if (code < 0x11ca9) {
                        // Mn  [22] MARCHEN SUBJOINED LETTER KA..MARCHEN SUBJOINED LETTER ZA
                        if (0x11c92 <= code && code <= 0x11ca7) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11caa) {
                          // Mc       MARCHEN SUBJOINED LETTER YA
                          if (0x11ca9 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [7] MARCHEN SUBJOINED LETTER RA..MARCHEN VOWEL SIGN AA
                          if (0x11caa <= code && code <= 0x11cb0) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x11d3a) {
                    if (code < 0x11cb4) {
                      if (code < 0x11cb2) {
                        // Mc       MARCHEN VOWEL SIGN I
                        if (0x11cb1 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [2] MARCHEN VOWEL SIGN U..MARCHEN VOWEL SIGN E
                        if (0x11cb2 <= code && code <= 0x11cb3) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x11cb5) {
                        // Mc       MARCHEN VOWEL SIGN O
                        if (0x11cb4 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        if (code < 0x11d31) {
                          // Mn   [2] MARCHEN SIGN ANUSVARA..MARCHEN SIGN CANDRABINDU
                          if (0x11cb5 <= code && code <= 0x11cb6) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [6] MASARAM GONDI VOWEL SIGN AA..MASARAM GONDI VOWEL SIGN VOCALIC R
                          if (0x11d31 <= code && code <= 0x11d36) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x11d46) {
                      if (code < 0x11d3c) {
                        // Mn       MASARAM GONDI VOWEL SIGN E
                        if (0x11d3a === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11d3f) {
                          // Mn   [2] MASARAM GONDI VOWEL SIGN AI..MASARAM GONDI VOWEL SIGN O
                          if (0x11d3c <= code && code <= 0x11d3d) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [7] MASARAM GONDI VOWEL SIGN AU..MASARAM GONDI VIRAMA
                          if (0x11d3f <= code && code <= 0x11d45) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x11d47) {
                        // Lo       MASARAM GONDI REPHA
                        if (0x11d46 === code) {
                          return boundaries_1.CLUSTER_BREAK.PREPEND;
                        }
                      } else {
                        if (code < 0x11d8a) {
                          // Mn       MASARAM GONDI RA-KARA
                          if (0x11d47 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mc   [5] GUNJALA GONDI VOWEL SIGN AA..GUNJALA GONDI VOWEL SIGN UU
                          if (0x11d8a <= code && code <= 0x11d8e) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x11f36) {
                  if (code < 0x11ef3) {
                    if (code < 0x11d95) {
                      if (code < 0x11d93) {
                        // Mn   [2] GUNJALA GONDI VOWEL SIGN EE..GUNJALA GONDI VOWEL SIGN AI
                        if (0x11d90 <= code && code <= 0x11d91) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc   [2] GUNJALA GONDI VOWEL SIGN OO..GUNJALA GONDI VOWEL SIGN AU
                        if (0x11d93 <= code && code <= 0x11d94) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x11d96) {
                        // Mn       GUNJALA GONDI SIGN ANUSVARA
                        if (0x11d95 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       GUNJALA GONDI SIGN VISARGA
                        if (0x11d96 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                        // Mn       GUNJALA GONDI VIRAMA
                        if (0x11d97 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0x11f02) {
                      if (code < 0x11ef5) {
                        // Mn   [2] MAKASAR VOWEL SIGN I..MAKASAR VOWEL SIGN U
                        if (0x11ef3 <= code && code <= 0x11ef4) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x11f00) {
                          // Mc   [2] MAKASAR VOWEL SIGN E..MAKASAR VOWEL SIGN O
                          if (0x11ef5 <= code && code <= 0x11ef6) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [2] KAWI SIGN CANDRABINDU..KAWI SIGN ANUSVARA
                          if (0x11f00 <= code && code <= 0x11f01) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x11f03) {
                        // Lo       KAWI SIGN REPHA
                        if (0x11f02 === code) {
                          return boundaries_1.CLUSTER_BREAK.PREPEND;
                        }
                      } else {
                        if (code < 0x11f34) {
                          // Mc       KAWI SIGN VISARGA
                          if (0x11f03 === code) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mc   [2] KAWI VOWEL SIGN AA..KAWI VOWEL SIGN ALTERNATE AA
                          if (0x11f34 <= code && code <= 0x11f35) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x13430) {
                    if (code < 0x11f40) {
                      if (code < 0x11f3e) {
                        // Mn   [5] KAWI VOWEL SIGN I..KAWI VOWEL SIGN VOCALIC R
                        if (0x11f36 <= code && code <= 0x11f3a) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc   [2] KAWI VOWEL SIGN E..KAWI VOWEL SIGN AI
                        if (0x11f3e <= code && code <= 0x11f3f) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x11f41) {
                        // Mn       KAWI VOWEL SIGN EU
                        if (0x11f40 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       KAWI SIGN KILLER
                        if (0x11f41 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                        // Mn       KAWI CONJOINER
                        if (0x11f42 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    }
                  } else {
                    if (code < 0x16af0) {
                      if (code < 0x13440) {
                        // Cf  [16] EGYPTIAN HIEROGLYPH VERTICAL JOINER..EGYPTIAN HIEROGLYPH END WALLED ENCLOSURE
                        if (0x13430 <= code && code <= 0x1343f) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      } else {
                        if (code < 0x13447) {
                          // Mn       EGYPTIAN HIEROGLYPH MIRROR HORIZONTALLY
                          if (0x13440 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn  [15] EGYPTIAN HIEROGLYPH MODIFIER DAMAGED AT TOP START..EGYPTIAN HIEROGLYPH MODIFIER DAMAGED
                          if (0x13447 <= code && code <= 0x13455) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x16b30) {
                        // Mn   [5] BASSA VAH COMBINING HIGH TONE..BASSA VAH COMBINING HIGH-LOW TONE
                        if (0x16af0 <= code && code <= 0x16af4) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x16f4f) {
                          // Mn   [7] PAHAWH HMONG MARK CIM TUB..PAHAWH HMONG MARK CIM TAUM
                          if (0x16b30 <= code && code <= 0x16b36) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       MIAO SIGN CONSONANT MODIFIER BAR
                          if (0x16f4f === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (code < 0x1da84) {
                if (code < 0x1d167) {
                  if (code < 0x1bca0) {
                    if (code < 0x16fe4) {
                      if (code < 0x16f8f) {
                        // Mc  [55] MIAO SIGN ASPIRATION..MIAO VOWEL SIGN UI
                        if (0x16f51 <= code && code <= 0x16f87) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      } else {
                        // Mn   [4] MIAO TONE RIGHT..MIAO TONE BELOW
                        if (0x16f8f <= code && code <= 0x16f92) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x16ff0) {
                        // Mn       KHITAN SMALL SCRIPT FILLER
                        if (0x16fe4 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1bc9d) {
                          // Mc   [2] VIETNAMESE ALTERNATE READING MARK CA..VIETNAMESE ALTERNATE READING MARK NHAY
                          if (0x16ff0 <= code && code <= 0x16ff1) {
                            return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                          }
                        } else {
                          // Mn   [2] DUPLOYAN THICK LETTER SELECTOR..DUPLOYAN DOUBLE MARK
                          if (0x1bc9d <= code && code <= 0x1bc9e) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1cf30) {
                      if (code < 0x1cf00) {
                        // Cf   [4] SHORTHAND FORMAT LETTER OVERLAP..SHORTHAND FORMAT UP STEP
                        if (0x1bca0 <= code && code <= 0x1bca3) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      } else {
                        // Mn  [46] ZNAMENNY COMBINING MARK GORAZDO NIZKO S KRYZHEM ON LEFT..ZNAMENNY COMBINING MARK KRYZH ON LEFT
                        if (0x1cf00 <= code && code <= 0x1cf2d) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x1d165) {
                        // Mn  [23] ZNAMENNY COMBINING TONAL RANGE MARK MRACHNO..ZNAMENNY PRIZNAK MODIFIER ROG
                        if (0x1cf30 <= code && code <= 0x1cf46) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       MUSICAL SYMBOL COMBINING STEM
                        if (0x1d165 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                        // Mc       MUSICAL SYMBOL COMBINING SPRECHGESANG STEM
                        if (0x1d166 === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x1d185) {
                    if (code < 0x1d16e) {
                      if (code < 0x1d16d) {
                        // Mn   [3] MUSICAL SYMBOL COMBINING TREMOLO-1..MUSICAL SYMBOL COMBINING TREMOLO-3
                        if (0x1d167 <= code && code <= 0x1d169) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mc       MUSICAL SYMBOL COMBINING AUGMENTATION DOT
                        if (0x1d16d === code) {
                          return boundaries_1.CLUSTER_BREAK.SPACINGMARK;
                        }
                      }
                    } else {
                      if (code < 0x1d173) {
                        // Mc   [5] MUSICAL SYMBOL COMBINING FLAG-1..MUSICAL SYMBOL COMBINING FLAG-5
                        if (0x1d16e <= code && code <= 0x1d172) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1d17b) {
                          // Cf   [8] MUSICAL SYMBOL BEGIN BEAM..MUSICAL SYMBOL END PHRASE
                          if (0x1d173 <= code && code <= 0x1d17a) {
                            return boundaries_1.CLUSTER_BREAK.CONTROL;
                          }
                        } else {
                          // Mn   [8] MUSICAL SYMBOL COMBINING ACCENT..MUSICAL SYMBOL COMBINING LOURE
                          if (0x1d17b <= code && code <= 0x1d182) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1da00) {
                      if (code < 0x1d1aa) {
                        // Mn   [7] MUSICAL SYMBOL COMBINING DOIT..MUSICAL SYMBOL COMBINING TRIPLE TONGUE
                        if (0x1d185 <= code && code <= 0x1d18b) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1d242) {
                          // Mn   [4] MUSICAL SYMBOL COMBINING DOWN BOW..MUSICAL SYMBOL COMBINING SNAP PIZZICATO
                          if (0x1d1aa <= code && code <= 0x1d1ad) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [3] COMBINING GREEK MUSICAL TRISEME..COMBINING GREEK MUSICAL PENTASEME
                          if (0x1d242 <= code && code <= 0x1d244) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1da3b) {
                        // Mn  [55] SIGNWRITING HEAD RIM..SIGNWRITING AIR SUCKING IN
                        if (0x1da00 <= code && code <= 0x1da36) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1da75) {
                          // Mn  [50] SIGNWRITING MOUTH CLOSED NEUTRAL..SIGNWRITING EXCITEMENT
                          if (0x1da3b <= code && code <= 0x1da6c) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       SIGNWRITING UPPER BODY TILTING FROM HIP JOINTS
                          if (0x1da75 === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                if (code < 0x1e2ec) {
                  if (code < 0x1e01b) {
                    if (code < 0x1daa1) {
                      if (code < 0x1da9b) {
                        // Mn       SIGNWRITING LOCATION HEAD NECK
                        if (0x1da84 === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [5] SIGNWRITING FILL MODIFIER-2..SIGNWRITING FILL MODIFIER-6
                        if (0x1da9b <= code && code <= 0x1da9f) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x1e000) {
                        // Mn  [15] SIGNWRITING ROTATION MODIFIER-2..SIGNWRITING ROTATION MODIFIER-16
                        if (0x1daa1 <= code && code <= 0x1daaf) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1e008) {
                          // Mn   [7] COMBINING GLAGOLITIC LETTER AZU..COMBINING GLAGOLITIC LETTER ZHIVETE
                          if (0x1e000 <= code && code <= 0x1e006) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn  [17] COMBINING GLAGOLITIC LETTER ZEMLJA..COMBINING GLAGOLITIC LETTER HERU
                          if (0x1e008 <= code && code <= 0x1e018) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0x1e08f) {
                      if (code < 0x1e023) {
                        // Mn   [7] COMBINING GLAGOLITIC LETTER SHTA..COMBINING GLAGOLITIC LETTER YATI
                        if (0x1e01b <= code && code <= 0x1e021) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1e026) {
                          // Mn   [2] COMBINING GLAGOLITIC LETTER YU..COMBINING GLAGOLITIC LETTER SMALL YUS
                          if (0x1e023 <= code && code <= 0x1e024) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn   [5] COMBINING GLAGOLITIC LETTER YO..COMBINING GLAGOLITIC LETTER FITA
                          if (0x1e026 <= code && code <= 0x1e02a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0x1e130) {
                        // Mn       COMBINING CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I
                        if (0x1e08f === code) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1e2ae) {
                          // Mn   [7] NYIAKENG PUACHUE HMONG TONE-B..NYIAKENG PUACHUE HMONG TONE-D
                          if (0x1e130 <= code && code <= 0x1e136) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Mn       TOTO SIGN RISING TONE
                          if (0x1e2ae === code) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    }
                  }
                } else {
                  if (code < 0x1f3fb) {
                    if (code < 0x1e8d0) {
                      if (code < 0x1e4ec) {
                        // Mn   [4] WANCHO TONE TUP..WANCHO TONE KOINI
                        if (0x1e2ec <= code && code <= 0x1e2ef) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        // Mn   [4] NAG MUNDARI SIGN MUHOR..NAG MUNDARI SIGN SUTUH
                        if (0x1e4ec <= code && code <= 0x1e4ef) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      }
                    } else {
                      if (code < 0x1e944) {
                        // Mn   [7] MENDE KIKAKUI COMBINING NUMBER TEENS..MENDE KIKAKUI COMBINING NUMBER MILLIONS
                        if (0x1e8d0 <= code && code <= 0x1e8d6) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0x1f1e6) {
                          // Mn   [7] ADLAM ALIF LENGTHENER..ADLAM NUKTA
                          if (0x1e944 <= code && code <= 0x1e94a) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // So  [26] REGIONAL INDICATOR SYMBOL LETTER A..REGIONAL INDICATOR SYMBOL LETTER Z
                          if (0x1f1e6 <= code && code <= 0x1f1ff) {
                            return boundaries_1.CLUSTER_BREAK.REGIONAL_INDICATOR;
                          }
                        }
                      }
                    }
                  } else {
                    if (code < 0xe0080) {
                      if (code < 0xe0000) {
                        // Sk   [5] EMOJI MODIFIER FITZPATRICK TYPE-1-2..EMOJI MODIFIER FITZPATRICK TYPE-6
                        if (0x1f3fb <= code && code <= 0x1f3ff) {
                          return boundaries_1.CLUSTER_BREAK.EXTEND;
                        }
                      } else {
                        if (code < 0xe0020) {
                          // Cn       <reserved-E0000>
                          // Cf       LANGUAGE TAG
                          // Cn  [30] <reserved-E0002>..<reserved-E001F>
                          if (0xe0000 <= code && code <= 0xe001f) {
                            return boundaries_1.CLUSTER_BREAK.CONTROL;
                          }
                        } else {
                          // Cf  [96] TAG SPACE..CANCEL TAG
                          if (0xe0020 <= code && code <= 0xe007f) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        }
                      }
                    } else {
                      if (code < 0xe0100) {
                        // Cn [128] <reserved-E0080>..<reserved-E00FF>
                        if (0xe0080 <= code && code <= 0xe00ff) {
                          return boundaries_1.CLUSTER_BREAK.CONTROL;
                        }
                      } else {
                        if (code < 0xe01f0) {
                          // Mn [240] VARIATION SELECTOR-17..VARIATION SELECTOR-256
                          if (0xe0100 <= code && code <= 0xe01ef) {
                            return boundaries_1.CLUSTER_BREAK.EXTEND;
                          }
                        } else {
                          // Cn [3600] <reserved-E01F0>..<reserved-E0FFF>
                          if (0xe01f0 <= code && code <= 0xe0fff) {
                            return boundaries_1.CLUSTER_BREAK.CONTROL;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    // unlisted code points are treated as a break property of "Other"
    return boundaries_1.CLUSTER_BREAK.OTHER;
  }
  /**
   * Given a Unicode code point, returns if symbol is an extended pictographic or some other break
   * @param code {number} Unicode code point
   * @returns {number}
   */
  static getEmojiProperty(code) {
    // emoji property taken from:
    // https://www.unicode.org/Public/UCD/latest/ucd/emoji/emoji-data.txt
    // and generated by
    // node ./scripts/generate-emoji-extended-pictographic.js
    if (code < 0x27b0) {
      if (code < 0x2600) {
        if (code < 0x2328) {
          if (code < 0x2122) {
            if (code < 0x203c) {
              // E0.6   [1] (©️)       copyright
              if (0xa9 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
              // E0.6   [1] (®️)       registered
              if (0xae === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
            } else {
              // E0.6   [1] (‼️)       double exclamation mark
              if (0x203c === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
              // E0.6   [1] (⁉️)       exclamation question mark
              if (0x2049 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
            }
          } else {
            if (code < 0x2194) {
              // E0.6   [1] (™️)       trade mark
              if (0x2122 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
              // E0.6   [1] (ℹ️)       information
              if (0x2139 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
            } else {
              if (code < 0x21a9) {
                // E0.6   [6] (↔️..↙️)    left-right arrow..down-left arrow
                if (0x2194 <= code && code <= 0x2199) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x231a) {
                  // E0.6   [2] (↩️..↪️)    right arrow curving left..left arrow curving right
                  if (0x21a9 <= code && code <= 0x21aa) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.6   [2] (⌚..⌛)    watch..hourglass done
                  if (0x231a <= code && code <= 0x231b) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          }
        } else {
          if (code < 0x24c2) {
            if (code < 0x23cf) {
              // E1.0   [1] (⌨️)       keyboard
              if (0x2328 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
              // E0.0   [1] (⎈)       HELM SYMBOL
              if (0x2388 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
            } else {
              if (code < 0x23e9) {
                // E1.0   [1] (⏏️)       eject button
                if (0x23cf === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x23f8) {
                  // E0.6   [4] (⏩..⏬)    fast-forward button..fast down button
                  // E0.7   [2] (⏭️..⏮️)    next track button..last track button
                  // E1.0   [1] (⏯️)       play or pause button
                  // E0.6   [1] (⏰)       alarm clock
                  // E1.0   [2] (⏱️..⏲️)    stopwatch..timer clock
                  // E0.6   [1] (⏳)       hourglass not done
                  if (0x23e9 <= code && code <= 0x23f3) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.7   [3] (⏸️..⏺️)    pause button..record button
                  if (0x23f8 <= code && code <= 0x23fa) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          } else {
            if (code < 0x25b6) {
              if (code < 0x25aa) {
                // E0.6   [1] (Ⓜ️)       circled M
                if (0x24c2 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [2] (▪️..▫️)    black small square..white small square
                if (0x25aa <= code && code <= 0x25ab) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x25c0) {
                // E0.6   [1] (▶️)       play button
                if (0x25b6 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x25fb) {
                  // E0.6   [1] (◀️)       reverse button
                  if (0x25c0 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.6   [4] (◻️..◾)    white medium square..black medium-small square
                  if (0x25fb <= code && code <= 0x25fe) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          }
        }
      } else {
        if (code < 0x2733) {
          if (code < 0x2714) {
            if (code < 0x2614) {
              if (code < 0x2607) {
                // E0.6   [2] (☀️..☁️)    sun..cloud
                // E0.7   [2] (☂️..☃️)    umbrella..snowman
                // E1.0   [1] (☄️)       comet
                // E0.0   [1] (★)       BLACK STAR
                if (0x2600 <= code && code <= 0x2605) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.0   [7] (☇..☍)    LIGHTNING..OPPOSITION
                // E0.6   [1] (☎️)       telephone
                // E0.0   [2] (☏..☐)    WHITE TELEPHONE..BALLOT BOX
                // E0.6   [1] (☑️)       check box with check
                // E0.0   [1] (☒)       BALLOT BOX WITH X
                if (0x2607 <= code && code <= 0x2612) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x2690) {
                // E0.6   [2] (☔..☕)    umbrella with rain drops..hot beverage
                // E0.0   [2] (☖..☗)    WHITE SHOGI PIECE..BLACK SHOGI PIECE
                // E1.0   [1] (☘️)       shamrock
                // E0.0   [4] (☙..☜)    REVERSED ROTATED FLORAL HEART BULLET..WHITE LEFT POINTING INDEX
                // E0.6   [1] (☝️)       index pointing up
                // E0.0   [2] (☞..☟)    WHITE RIGHT POINTING INDEX..WHITE DOWN POINTING INDEX
                // E1.0   [1] (☠️)       skull and crossbones
                // E0.0   [1] (☡)       CAUTION SIGN
                // E1.0   [2] (☢️..☣️)    radioactive..biohazard
                // E0.0   [2] (☤..☥)    CADUCEUS..ANKH
                // E1.0   [1] (☦️)       orthodox cross
                // E0.0   [3] (☧..☩)    CHI RHO..CROSS OF JERUSALEM
                // E0.7   [1] (☪️)       star and crescent
                // E0.0   [3] (☫..☭)    FARSI SYMBOL..HAMMER AND SICKLE
                // E1.0   [1] (☮️)       peace symbol
                // E0.7   [1] (☯️)       yin yang
                // E0.0   [8] (☰..☷)    TRIGRAM FOR HEAVEN..TRIGRAM FOR EARTH
                // E0.7   [2] (☸️..☹️)    wheel of dharma..frowning face
                // E0.6   [1] (☺️)       smiling face
                // E0.0   [5] (☻..☿)    BLACK SMILING FACE..MERCURY
                // E4.0   [1] (♀️)       female sign
                // E0.0   [1] (♁)       EARTH
                // E4.0   [1] (♂️)       male sign
                // E0.0   [5] (♃..♇)    JUPITER..PLUTO
                // E0.6  [12] (♈..♓)    Aries..Pisces
                // E0.0  [11] (♔..♞)    WHITE CHESS KING..BLACK CHESS KNIGHT
                // E11.0  [1] (♟️)       chess pawn
                // E0.6   [1] (♠️)       spade suit
                // E0.0   [2] (♡..♢)    WHITE HEART SUIT..WHITE DIAMOND SUIT
                // E0.6   [1] (♣️)       club suit
                // E0.0   [1] (♤)       WHITE SPADE SUIT
                // E0.6   [2] (♥️..♦️)    heart suit..diamond suit
                // E0.0   [1] (♧)       WHITE CLUB SUIT
                // E0.6   [1] (♨️)       hot springs
                // E0.0  [18] (♩..♺)    QUARTER NOTE..RECYCLING SYMBOL FOR GENERIC MATERIALS
                // E0.6   [1] (♻️)       recycling symbol
                // E0.0   [2] (♼..♽)    RECYCLED PAPER SYMBOL..PARTIALLY-RECYCLED PAPER SYMBOL
                // E11.0  [1] (♾️)       infinity
                // E0.6   [1] (♿)       wheelchair symbol
                // E0.0   [6] (⚀..⚅)    DIE FACE-1..DIE FACE-6
                if (0x2614 <= code && code <= 0x2685) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x2708) {
                  // E0.0   [2] (⚐..⚑)    WHITE FLAG..BLACK FLAG
                  // E1.0   [1] (⚒️)       hammer and pick
                  // E0.6   [1] (⚓)       anchor
                  // E1.0   [1] (⚔️)       crossed swords
                  // E4.0   [1] (⚕️)       medical symbol
                  // E1.0   [2] (⚖️..⚗️)    balance scale..alembic
                  // E0.0   [1] (⚘)       FLOWER
                  // E1.0   [1] (⚙️)       gear
                  // E0.0   [1] (⚚)       STAFF OF HERMES
                  // E1.0   [2] (⚛️..⚜️)    atom symbol..fleur-de-lis
                  // E0.0   [3] (⚝..⚟)    OUTLINED WHITE STAR..THREE LINES CONVERGING LEFT
                  // E0.6   [2] (⚠️..⚡)    warning..high voltage
                  // E0.0   [5] (⚢..⚦)    DOUBLED FEMALE SIGN..MALE WITH STROKE SIGN
                  // E13.0  [1] (⚧️)       transgender symbol
                  // E0.0   [2] (⚨..⚩)    VERTICAL MALE WITH STROKE SIGN..HORIZONTAL MALE WITH STROKE SIGN
                  // E0.6   [2] (⚪..⚫)    white circle..black circle
                  // E0.0   [4] (⚬..⚯)    MEDIUM SMALL WHITE CIRCLE..UNMARRIED PARTNERSHIP SYMBOL
                  // E1.0   [2] (⚰️..⚱️)    coffin..funeral urn
                  // E0.0  [11] (⚲..⚼)    NEUTER..SESQUIQUADRATE
                  // E0.6   [2] (⚽..⚾)    soccer ball..baseball
                  // E0.0   [5] (⚿..⛃)    SQUARED KEY..BLACK DRAUGHTS KING
                  // E0.6   [2] (⛄..⛅)    snowman without snow..sun behind cloud
                  // E0.0   [2] (⛆..⛇)    RAIN..BLACK SNOWMAN
                  // E0.7   [1] (⛈️)       cloud with lightning and rain
                  // E0.0   [5] (⛉..⛍)    TURNED WHITE SHOGI PIECE..DISABLED CAR
                  // E0.6   [1] (⛎)       Ophiuchus
                  // E0.7   [1] (⛏️)       pick
                  // E0.0   [1] (⛐)       CAR SLIDING
                  // E0.7   [1] (⛑️)       rescue worker’s helmet
                  // E0.0   [1] (⛒)       CIRCLED CROSSING LANES
                  // E0.7   [1] (⛓️)       chains
                  // E0.6   [1] (⛔)       no entry
                  // E0.0  [20] (⛕..⛨)    ALTERNATE ONE-WAY LEFT WAY TRAFFIC..BLACK CROSS ON SHIELD
                  // E0.7   [1] (⛩️)       shinto shrine
                  // E0.6   [1] (⛪)       church
                  // E0.0   [5] (⛫..⛯)    CASTLE..MAP SYMBOL FOR LIGHTHOUSE
                  // E0.7   [2] (⛰️..⛱️)    mountain..umbrella on ground
                  // E0.6   [2] (⛲..⛳)    fountain..flag in hole
                  // E0.7   [1] (⛴️)       ferry
                  // E0.6   [1] (⛵)       sailboat
                  // E0.0   [1] (⛶)       SQUARE FOUR CORNERS
                  // E0.7   [3] (⛷️..⛹️)    skier..person bouncing ball
                  // E0.6   [1] (⛺)       tent
                  // E0.0   [2] (⛻..⛼)    JAPANESE BANK SYMBOL..HEADSTONE GRAVEYARD SYMBOL
                  // E0.6   [1] (⛽)       fuel pump
                  // E0.0   [4] (⛾..✁)    CUP ON BLACK SQUARE..UPPER BLADE SCISSORS
                  // E0.6   [1] (✂️)       scissors
                  // E0.0   [2] (✃..✄)    LOWER BLADE SCISSORS..WHITE SCISSORS
                  // E0.6   [1] (✅)       check mark button
                  if (0x2690 <= code && code <= 0x2705) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.6   [5] (✈️..✌️)    airplane..victory hand
                  // E0.7   [1] (✍️)       writing hand
                  // E0.0   [1] (✎)       LOWER RIGHT PENCIL
                  // E0.6   [1] (✏️)       pencil
                  // E0.0   [2] (✐..✑)    UPPER RIGHT PENCIL..WHITE NIB
                  // E0.6   [1] (✒️)       black nib
                  if (0x2708 <= code && code <= 0x2712) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          } else {
            if (code < 0x271d) {
              // E0.6   [1] (✔️)       check mark
              if (0x2714 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
              // E0.6   [1] (✖️)       multiply
              if (0x2716 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
            } else {
              if (code < 0x2721) {
                // E0.7   [1] (✝️)       latin cross
                if (0x271d === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.7   [1] (✡️)       star of David
                if (0x2721 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
                // E0.6   [1] (✨)       sparkles
                if (0x2728 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            }
          }
        } else {
          if (code < 0x2753) {
            if (code < 0x2747) {
              if (code < 0x2744) {
                // E0.6   [2] (✳️..✴️)    eight-spoked asterisk..eight-pointed star
                if (0x2733 <= code && code <= 0x2734) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [1] (❄️)       snowflake
                if (0x2744 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x274c) {
                // E0.6   [1] (❇️)       sparkle
                if (0x2747 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [1] (❌)       cross mark
                if (0x274c === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
                // E0.6   [1] (❎)       cross mark button
                if (0x274e === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            }
          } else {
            if (code < 0x2763) {
              if (code < 0x2757) {
                // E0.6   [3] (❓..❕)    red question mark..white exclamation mark
                if (0x2753 <= code && code <= 0x2755) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [1] (❗)       red exclamation mark
                if (0x2757 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x2795) {
                // E1.0   [1] (❣️)       heart exclamation
                // E0.6   [1] (❤️)       red heart
                // E0.0   [3] (❥..❧)    ROTATED HEAVY BLACK HEART BULLET..ROTATED FLORAL HEART BULLET
                if (0x2763 <= code && code <= 0x2767) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x27a1) {
                  // E0.6   [3] (➕..➗)    plus..divide
                  if (0x2795 <= code && code <= 0x2797) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.6   [1] (➡️)       right arrow
                  if (0x27a1 === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      if (code < 0x1f201) {
        if (code < 0x3297) {
          if (code < 0x2b1b) {
            if (code < 0x2934) {
              // E0.6   [1] (➰)       curly loop
              if (0x27b0 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
              // E1.0   [1] (➿)       double curly loop
              if (0x27bf === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
            } else {
              if (code < 0x2b05) {
                // E0.6   [2] (⤴️..⤵️)    right arrow curving up..right arrow curving down
                if (0x2934 <= code && code <= 0x2935) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [3] (⬅️..⬇️)    left arrow..down arrow
                if (0x2b05 <= code && code <= 0x2b07) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            }
          } else {
            if (code < 0x2b55) {
              if (code < 0x2b50) {
                // E0.6   [2] (⬛..⬜)    black large square..white large square
                if (0x2b1b <= code && code <= 0x2b1c) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [1] (⭐)       star
                if (0x2b50 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x3030) {
                // E0.6   [1] (⭕)       hollow red circle
                if (0x2b55 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [1] (〰️)       wavy dash
                if (0x3030 === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
                // E0.6   [1] (〽️)       part alternation mark
                if (0x303d === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            }
          }
        } else {
          if (code < 0x1f16c) {
            if (code < 0x1f000) {
              // E0.6   [1] (㊗️)       Japanese “congratulations” button
              if (0x3297 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
              // E0.6   [1] (㊙️)       Japanese “secret” button
              if (0x3299 === code) {
                return boundaries_1.EXTENDED_PICTOGRAPHIC;
              }
            } else {
              if (code < 0x1f10d) {
                // E0.0   [4] (🀀..🀃)    MAHJONG TILE EAST WIND..MAHJONG TILE NORTH WIND
                // E0.6   [1] (🀄)       mahjong red dragon
                // E0.0 [202] (🀅..🃎)    MAHJONG TILE GREEN DRAGON..PLAYING CARD KING OF DIAMONDS
                // E0.6   [1] (🃏)       joker
                // E0.0  [48] (🃐..🃿)    <reserved-1F0D0>..<reserved-1F0FF>
                if (0x1f000 <= code && code <= 0x1f0ff) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x1f12f) {
                  // E0.0   [3] (🄍..🄏)    CIRCLED ZERO WITH SLASH..CIRCLED DOLLAR SIGN WITH OVERLAID BACKSLASH
                  if (0x1f10d <= code && code <= 0x1f10f) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.0   [1] (🄯)       COPYLEFT SYMBOL
                  if (0x1f12f === code) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          } else {
            if (code < 0x1f18e) {
              if (code < 0x1f17e) {
                // E0.0   [4] (🅬..🅯)    RAISED MR SIGN..CIRCLED HUMAN FIGURE
                // E0.6   [2] (🅰️..🅱️)    A button (blood type)..B button (blood type)
                if (0x1f16c <= code && code <= 0x1f171) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [2] (🅾️..🅿️)    O button (blood type)..P button
                if (0x1f17e <= code && code <= 0x1f17f) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x1f191) {
                // E0.6   [1] (🆎)       AB button (blood type)
                if (0x1f18e === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x1f1ad) {
                  // E0.6  [10] (🆑..🆚)    CL button..VS button
                  if (0x1f191 <= code && code <= 0x1f19a) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.0  [57] (🆭..🇥)    MASK WORK SYMBOL..<reserved-1F1E5>
                  if (0x1f1ad <= code && code <= 0x1f1e5) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          }
        }
      } else {
        if (code < 0x1f7d5) {
          if (code < 0x1f249) {
            if (code < 0x1f22f) {
              if (code < 0x1f21a) {
                // E0.6   [2] (🈁..🈂️)    Japanese “here” button..Japanese “service charge” button
                // E0.0  [13] (🈃..🈏)    <reserved-1F203>..<reserved-1F20F>
                if (0x1f201 <= code && code <= 0x1f20f) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.6   [1] (🈚)       Japanese “free of charge” button
                if (0x1f21a === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x1f232) {
                // E0.6   [1] (🈯)       Japanese “reserved” button
                if (0x1f22f === code) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x1f23c) {
                  // E0.6   [9] (🈲..🈺)    Japanese “prohibited” button..Japanese “open for business” button
                  if (0x1f232 <= code && code <= 0x1f23a) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.0   [4] (🈼..🈿)    <reserved-1F23C>..<reserved-1F23F>
                  if (0x1f23c <= code && code <= 0x1f23f) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          } else {
            if (code < 0x1f546) {
              if (code < 0x1f400) {
                // E0.0   [7] (🉉..🉏)    <reserved-1F249>..<reserved-1F24F>
                // E0.6   [2] (🉐..🉑)    Japanese “bargain” button..Japanese “acceptable” button
                // E0.0 [174] (🉒..🋿)    <reserved-1F252>..<reserved-1F2FF>
                // E0.6  [13] (🌀..🌌)    cyclone..milky way
                // E0.7   [2] (🌍..🌎)    globe showing Europe-Africa..globe showing Americas
                // E0.6   [1] (🌏)       globe showing Asia-Australia
                // E1.0   [1] (🌐)       globe with meridians
                // E0.6   [1] (🌑)       new moon
                // E1.0   [1] (🌒)       waxing crescent moon
                // E0.6   [3] (🌓..🌕)    first quarter moon..full moon
                // E1.0   [3] (🌖..🌘)    waning gibbous moon..waning crescent moon
                // E0.6   [1] (🌙)       crescent moon
                // E1.0   [1] (🌚)       new moon face
                // E0.6   [1] (🌛)       first quarter moon face
                // E0.7   [1] (🌜)       last quarter moon face
                // E1.0   [2] (🌝..🌞)    full moon face..sun with face
                // E0.6   [2] (🌟..🌠)    glowing star..shooting star
                // E0.7   [1] (🌡️)       thermometer
                // E0.0   [2] (🌢..🌣)    BLACK DROPLET..WHITE SUN
                // E0.7   [9] (🌤️..🌬️)    sun behind small cloud..wind face
                // E1.0   [3] (🌭..🌯)    hot dog..burrito
                // E0.6   [2] (🌰..🌱)    chestnut..seedling
                // E1.0   [2] (🌲..🌳)    evergreen tree..deciduous tree
                // E0.6   [2] (🌴..🌵)    palm tree..cactus
                // E0.7   [1] (🌶️)       hot pepper
                // E0.6  [20] (🌷..🍊)    tulip..tangerine
                // E1.0   [1] (🍋)       lemon
                // E0.6   [4] (🍌..🍏)    banana..green apple
                // E1.0   [1] (🍐)       pear
                // E0.6  [43] (🍑..🍻)    peach..clinking beer mugs
                // E1.0   [1] (🍼)       baby bottle
                // E0.7   [1] (🍽️)       fork and knife with plate
                // E1.0   [2] (🍾..🍿)    bottle with popping cork..popcorn
                // E0.6  [20] (🎀..🎓)    ribbon..graduation cap
                // E0.0   [2] (🎔..🎕)    HEART WITH TIP ON THE LEFT..BOUQUET OF FLOWERS
                // E0.7   [2] (🎖️..🎗️)    military medal..reminder ribbon
                // E0.0   [1] (🎘)       MUSICAL KEYBOARD WITH JACKS
                // E0.7   [3] (🎙️..🎛️)    studio microphone..control knobs
                // E0.0   [2] (🎜..🎝)    BEAMED ASCENDING MUSICAL NOTES..BEAMED DESCENDING MUSICAL NOTES
                // E0.7   [2] (🎞️..🎟️)    film frames..admission tickets
                // E0.6  [37] (🎠..🏄)    carousel horse..person surfing
                // E1.0   [1] (🏅)       sports medal
                // E0.6   [1] (🏆)       trophy
                // E1.0   [1] (🏇)       horse racing
                // E0.6   [1] (🏈)       american football
                // E1.0   [1] (🏉)       rugby football
                // E0.6   [1] (🏊)       person swimming
                // E0.7   [4] (🏋️..🏎️)    person lifting weights..racing car
                // E1.0   [5] (🏏..🏓)    cricket game..ping pong
                // E0.7  [12] (🏔️..🏟️)    snow-capped mountain..stadium
                // E0.6   [4] (🏠..🏣)    house..Japanese post office
                // E1.0   [1] (🏤)       post office
                // E0.6  [12] (🏥..🏰)    hospital..castle
                // E0.0   [2] (🏱..🏲)    WHITE PENNANT..BLACK PENNANT
                // E0.7   [1] (🏳️)       white flag
                // E1.0   [1] (🏴)       black flag
                // E0.7   [1] (🏵️)       rosette
                // E0.0   [1] (🏶)       BLACK ROSETTE
                // E0.7   [1] (🏷️)       label
                // E1.0   [3] (🏸..🏺)    badminton..amphora
                if (0x1f249 <= code && code <= 0x1f3fa) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E1.0   [8] (🐀..🐇)    rat..rabbit
                // E0.7   [1] (🐈)       cat
                // E1.0   [3] (🐉..🐋)    dragon..whale
                // E0.6   [3] (🐌..🐎)    snail..horse
                // E1.0   [2] (🐏..🐐)    ram..goat
                // E0.6   [2] (🐑..🐒)    ewe..monkey
                // E1.0   [1] (🐓)       rooster
                // E0.6   [1] (🐔)       chicken
                // E0.7   [1] (🐕)       dog
                // E1.0   [1] (🐖)       pig
                // E0.6  [19] (🐗..🐩)    boar..poodle
                // E1.0   [1] (🐪)       camel
                // E0.6  [20] (🐫..🐾)    two-hump camel..paw prints
                // E0.7   [1] (🐿️)       chipmunk
                // E0.6   [1] (👀)       eyes
                // E0.7   [1] (👁️)       eye
                // E0.6  [35] (👂..👤)    ear..bust in silhouette
                // E1.0   [1] (👥)       busts in silhouette
                // E0.6   [6] (👦..👫)    boy..woman and man holding hands
                // E1.0   [2] (👬..👭)    men holding hands..women holding hands
                // E0.6  [63] (👮..💬)    police officer..speech balloon
                // E1.0   [1] (💭)       thought balloon
                // E0.6   [8] (💮..💵)    white flower..dollar banknote
                // E1.0   [2] (💶..💷)    euro banknote..pound banknote
                // E0.6  [52] (💸..📫)    money with wings..closed mailbox with raised flag
                // E0.7   [2] (📬..📭)    open mailbox with raised flag..open mailbox with lowered flag
                // E0.6   [1] (📮)       postbox
                // E1.0   [1] (📯)       postal horn
                // E0.6   [5] (📰..📴)    newspaper..mobile phone off
                // E1.0   [1] (📵)       no mobile phones
                // E0.6   [2] (📶..📷)    antenna bars..camera
                // E1.0   [1] (📸)       camera with flash
                // E0.6   [4] (📹..📼)    video camera..videocassette
                // E0.7   [1] (📽️)       film projector
                // E0.0   [1] (📾)       PORTABLE STEREO
                // E1.0   [4] (📿..🔂)    prayer beads..repeat single button
                // E0.6   [1] (🔃)       clockwise vertical arrows
                // E1.0   [4] (🔄..🔇)    counterclockwise arrows button..muted speaker
                // E0.7   [1] (🔈)       speaker low volume
                // E1.0   [1] (🔉)       speaker medium volume
                // E0.6  [11] (🔊..🔔)    speaker high volume..bell
                // E1.0   [1] (🔕)       bell with slash
                // E0.6  [22] (🔖..🔫)    bookmark..water pistol
                // E1.0   [2] (🔬..🔭)    microscope..telescope
                // E0.6  [16] (🔮..🔽)    crystal ball..downwards button
                if (0x1f400 <= code && code <= 0x1f53d) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x1f680) {
                // E0.0   [3] (🕆..🕈)    WHITE LATIN CROSS..CELTIC CROSS
                // E0.7   [2] (🕉️..🕊️)    om..dove
                // E1.0   [4] (🕋..🕎)    kaaba..menorah
                // E0.0   [1] (🕏)       BOWL OF HYGIEIA
                // E0.6  [12] (🕐..🕛)    one o’clock..twelve o’clock
                // E0.7  [12] (🕜..🕧)    one-thirty..twelve-thirty
                // E0.0   [7] (🕨..🕮)    RIGHT SPEAKER..BOOK
                // E0.7   [2] (🕯️..🕰️)    candle..mantelpiece clock
                // E0.0   [2] (🕱..🕲)    BLACK SKULL AND CROSSBONES..NO PIRACY
                // E0.7   [7] (🕳️..🕹️)    hole..joystick
                // E3.0   [1] (🕺)       man dancing
                // E0.0  [12] (🕻..🖆)    LEFT HAND TELEPHONE RECEIVER..PEN OVER STAMPED ENVELOPE
                // E0.7   [1] (🖇️)       linked paperclips
                // E0.0   [2] (🖈..🖉)    BLACK PUSHPIN..LOWER LEFT PENCIL
                // E0.7   [4] (🖊️..🖍️)    pen..crayon
                // E0.0   [2] (🖎..🖏)    LEFT WRITING HAND..TURNED OK HAND SIGN
                // E0.7   [1] (🖐️)       hand with fingers splayed
                // E0.0   [4] (🖑..🖔)    REVERSED RAISED HAND WITH FINGERS SPLAYED..REVERSED VICTORY HAND
                // E1.0   [2] (🖕..🖖)    middle finger..vulcan salute
                // E0.0  [13] (🖗..🖣)    WHITE DOWN POINTING LEFT HAND INDEX..BLACK DOWN POINTING BACKHAND INDEX
                // E3.0   [1] (🖤)       black heart
                // E0.7   [1] (🖥️)       desktop computer
                // E0.0   [2] (🖦..🖧)    KEYBOARD AND MOUSE..THREE NETWORKED COMPUTERS
                // E0.7   [1] (🖨️)       printer
                // E0.0   [8] (🖩..🖰)    POCKET CALCULATOR..TWO BUTTON MOUSE
                // E0.7   [2] (🖱️..🖲️)    computer mouse..trackball
                // E0.0   [9] (🖳..🖻)    OLD PERSONAL COMPUTER..DOCUMENT WITH PICTURE
                // E0.7   [1] (🖼️)       framed picture
                // E0.0   [5] (🖽..🗁)    FRAME WITH TILES..OPEN FOLDER
                // E0.7   [3] (🗂️..🗄️)    card index dividers..file cabinet
                // E0.0  [12] (🗅..🗐)    EMPTY NOTE..PAGES
                // E0.7   [3] (🗑️..🗓️)    wastebasket..spiral calendar
                // E0.0   [8] (🗔..🗛)    DESKTOP WINDOW..DECREASE FONT SIZE SYMBOL
                // E0.7   [3] (🗜️..🗞️)    clamp..rolled-up newspaper
                // E0.0   [2] (🗟..🗠)    PAGE WITH CIRCLED TEXT..STOCK CHART
                // E0.7   [1] (🗡️)       dagger
                // E0.0   [1] (🗢)       LIPS
                // E0.7   [1] (🗣️)       speaking head
                // E0.0   [4] (🗤..🗧)    THREE RAYS ABOVE..THREE RAYS RIGHT
                // E2.0   [1] (🗨️)       left speech bubble
                // E0.0   [6] (🗩..🗮)    RIGHT SPEECH BUBBLE..LEFT ANGER BUBBLE
                // E0.7   [1] (🗯️)       right anger bubble
                // E0.0   [3] (🗰..🗲)    MOOD BUBBLE..LIGHTNING MOOD
                // E0.7   [1] (🗳️)       ballot box with ballot
                // E0.0   [6] (🗴..🗹)    BALLOT SCRIPT X..BALLOT BOX WITH BOLD CHECK
                // E0.7   [1] (🗺️)       world map
                // E0.6   [5] (🗻..🗿)    mount fuji..moai
                // E1.0   [1] (😀)       grinning face
                // E0.6   [6] (😁..😆)    beaming face with smiling eyes..grinning squinting face
                // E1.0   [2] (😇..😈)    smiling face with halo..smiling face with horns
                // E0.6   [5] (😉..😍)    winking face..smiling face with heart-eyes
                // E1.0   [1] (😎)       smiling face with sunglasses
                // E0.6   [1] (😏)       smirking face
                // E0.7   [1] (😐)       neutral face
                // E1.0   [1] (😑)       expressionless face
                // E0.6   [3] (😒..😔)    unamused face..pensive face
                // E1.0   [1] (😕)       confused face
                // E0.6   [1] (😖)       confounded face
                // E1.0   [1] (😗)       kissing face
                // E0.6   [1] (😘)       face blowing a kiss
                // E1.0   [1] (😙)       kissing face with smiling eyes
                // E0.6   [1] (😚)       kissing face with closed eyes
                // E1.0   [1] (😛)       face with tongue
                // E0.6   [3] (😜..😞)    winking face with tongue..disappointed face
                // E1.0   [1] (😟)       worried face
                // E0.6   [6] (😠..😥)    angry face..sad but relieved face
                // E1.0   [2] (😦..😧)    frowning face with open mouth..anguished face
                // E0.6   [4] (😨..😫)    fearful face..tired face
                // E1.0   [1] (😬)       grimacing face
                // E0.6   [1] (😭)       loudly crying face
                // E1.0   [2] (😮..😯)    face with open mouth..hushed face
                // E0.6   [4] (😰..😳)    anxious face with sweat..flushed face
                // E1.0   [1] (😴)       sleeping face
                // E0.6   [1] (😵)       face with crossed-out eyes
                // E1.0   [1] (😶)       face without mouth
                // E0.6  [10] (😷..🙀)    face with medical mask..weary cat
                // E1.0   [4] (🙁..🙄)    slightly frowning face..face with rolling eyes
                // E0.6  [11] (🙅..🙏)    person gesturing NO..folded hands
                if (0x1f546 <= code && code <= 0x1f64f) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x1f774) {
                  // E0.6   [1] (🚀)       rocket
                  // E1.0   [2] (🚁..🚂)    helicopter..locomotive
                  // E0.6   [3] (🚃..🚅)    railway car..bullet train
                  // E1.0   [1] (🚆)       train
                  // E0.6   [1] (🚇)       metro
                  // E1.0   [1] (🚈)       light rail
                  // E0.6   [1] (🚉)       station
                  // E1.0   [2] (🚊..🚋)    tram..tram car
                  // E0.6   [1] (🚌)       bus
                  // E0.7   [1] (🚍)       oncoming bus
                  // E1.0   [1] (🚎)       trolleybus
                  // E0.6   [1] (🚏)       bus stop
                  // E1.0   [1] (🚐)       minibus
                  // E0.6   [3] (🚑..🚓)    ambulance..police car
                  // E0.7   [1] (🚔)       oncoming police car
                  // E0.6   [1] (🚕)       taxi
                  // E1.0   [1] (🚖)       oncoming taxi
                  // E0.6   [1] (🚗)       automobile
                  // E0.7   [1] (🚘)       oncoming automobile
                  // E0.6   [2] (🚙..🚚)    sport utility vehicle..delivery truck
                  // E1.0   [7] (🚛..🚡)    articulated lorry..aerial tramway
                  // E0.6   [1] (🚢)       ship
                  // E1.0   [1] (🚣)       person rowing boat
                  // E0.6   [2] (🚤..🚥)    speedboat..horizontal traffic light
                  // E1.0   [1] (🚦)       vertical traffic light
                  // E0.6   [7] (🚧..🚭)    construction..no smoking
                  // E1.0   [4] (🚮..🚱)    litter in bin sign..non-potable water
                  // E0.6   [1] (🚲)       bicycle
                  // E1.0   [3] (🚳..🚵)    no bicycles..person mountain biking
                  // E0.6   [1] (🚶)       person walking
                  // E1.0   [2] (🚷..🚸)    no pedestrians..children crossing
                  // E0.6   [6] (🚹..🚾)    men’s room..water closet
                  // E1.0   [1] (🚿)       shower
                  // E0.6   [1] (🛀)       person taking bath
                  // E1.0   [5] (🛁..🛅)    bathtub..left luggage
                  // E0.0   [5] (🛆..🛊)    TRIANGLE WITH ROUNDED CORNERS..GIRLS SYMBOL
                  // E0.7   [1] (🛋️)       couch and lamp
                  // E1.0   [1] (🛌)       person in bed
                  // E0.7   [3] (🛍️..🛏️)    shopping bags..bed
                  // E1.0   [1] (🛐)       place of worship
                  // E3.0   [2] (🛑..🛒)    stop sign..shopping cart
                  // E0.0   [2] (🛓..🛔)    STUPA..PAGODA
                  // E12.0  [1] (🛕)       hindu temple
                  // E13.0  [2] (🛖..🛗)    hut..elevator
                  // E0.0   [4] (🛘..🛛)    <reserved-1F6D8>..<reserved-1F6DB>
                  // E15.0  [1] (🛜)       wireless
                  // E14.0  [3] (🛝..🛟)    playground slide..ring buoy
                  // E0.7   [6] (🛠️..🛥️)    hammer and wrench..motor boat
                  // E0.0   [3] (🛦..🛨)    UP-POINTING MILITARY AIRPLANE..UP-POINTING SMALL AIRPLANE
                  // E0.7   [1] (🛩️)       small airplane
                  // E0.0   [1] (🛪)       NORTHEAST-POINTING AIRPLANE
                  // E1.0   [2] (🛫..🛬)    airplane departure..airplane arrival
                  // E0.0   [3] (🛭..🛯)    <reserved-1F6ED>..<reserved-1F6EF>
                  // E0.7   [1] (🛰️)       satellite
                  // E0.0   [2] (🛱..🛲)    ONCOMING FIRE ENGINE..DIESEL LOCOMOTIVE
                  // E0.7   [1] (🛳️)       passenger ship
                  // E3.0   [3] (🛴..🛶)    kick scooter..canoe
                  // E5.0   [2] (🛷..🛸)    sled..flying saucer
                  // E11.0  [1] (🛹)       skateboard
                  // E12.0  [1] (🛺)       auto rickshaw
                  // E13.0  [2] (🛻..🛼)    pickup truck..roller skate
                  // E0.0   [3] (🛽..🛿)    <reserved-1F6FD>..<reserved-1F6FF>
                  if (0x1f680 <= code && code <= 0x1f6ff) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.0  [12] (🝴..🝿)    LOT OF FORTUNE..ORCUS
                  if (0x1f774 <= code && code <= 0x1f77f) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          }
        } else {
          if (code < 0x1f8ae) {
            if (code < 0x1f848) {
              if (code < 0x1f80c) {
                // E0.0  [11] (🟕..🟟)    CIRCLED TRIANGLE..<reserved-1F7DF>
                // E12.0 [12] (🟠..🟫)    orange circle..brown square
                // E0.0   [4] (🟬..🟯)    <reserved-1F7EC>..<reserved-1F7EF>
                // E14.0  [1] (🟰)       heavy equals sign
                // E0.0  [15] (🟱..🟿)    <reserved-1F7F1>..<reserved-1F7FF>
                if (0x1f7d5 <= code && code <= 0x1f7ff) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E0.0   [4] (🠌..🠏)    <reserved-1F80C>..<reserved-1F80F>
                if (0x1f80c <= code && code <= 0x1f80f) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x1f85a) {
                // E0.0   [8] (🡈..🡏)    <reserved-1F848>..<reserved-1F84F>
                if (0x1f848 <= code && code <= 0x1f84f) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x1f888) {
                  // E0.0   [6] (🡚..🡟)    <reserved-1F85A>..<reserved-1F85F>
                  if (0x1f85a <= code && code <= 0x1f85f) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.0   [8] (🢈..🢏)    <reserved-1F888>..<reserved-1F88F>
                  if (0x1f888 <= code && code <= 0x1f88f) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          } else {
            if (code < 0x1f93c) {
              if (code < 0x1f90c) {
                // E0.0  [82] (🢮..🣿)    <reserved-1F8AE>..<reserved-1F8FF>
                if (0x1f8ae <= code && code <= 0x1f8ff) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                // E13.0  [1] (🤌)       pinched fingers
                // E12.0  [3] (🤍..🤏)    white heart..pinching hand
                // E1.0   [9] (🤐..🤘)    zipper-mouth face..sign of the horns
                // E3.0   [6] (🤙..🤞)    call me hand..crossed fingers
                // E5.0   [1] (🤟)       love-you gesture
                // E3.0   [8] (🤠..🤧)    cowboy hat face..sneezing face
                // E5.0   [8] (🤨..🤯)    face with raised eyebrow..exploding head
                // E3.0   [1] (🤰)       pregnant woman
                // E5.0   [2] (🤱..🤲)    breast-feeding..palms up together
                // E3.0   [8] (🤳..🤺)    selfie..person fencing
                if (0x1f90c <= code && code <= 0x1f93a) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              }
            } else {
              if (code < 0x1f947) {
                // E3.0   [3] (🤼..🤾)    people wrestling..person playing handball
                // E12.0  [1] (🤿)       diving mask
                // E3.0   [6] (🥀..🥅)    wilted flower..goal net
                if (0x1f93c <= code && code <= 0x1f945) {
                  return boundaries_1.EXTENDED_PICTOGRAPHIC;
                }
              } else {
                if (code < 0x1fc00) {
                  // E3.0   [5] (🥇..🥋)    1st place medal..martial arts uniform
                  // E5.0   [1] (🥌)       curling stone
                  // E11.0  [3] (🥍..🥏)    lacrosse..flying disc
                  // E3.0  [15] (🥐..🥞)    croissant..pancakes
                  // E5.0  [13] (🥟..🥫)    dumpling..canned food
                  // E11.0  [5] (🥬..🥰)    leafy green..smiling face with hearts
                  // E12.0  [1] (🥱)       yawning face
                  // E13.0  [1] (🥲)       smiling face with tear
                  // E11.0  [4] (🥳..🥶)    partying face..cold face
                  // E13.0  [2] (🥷..🥸)    ninja..disguised face
                  // E14.0  [1] (🥹)       face holding back tears
                  // E11.0  [1] (🥺)       pleading face
                  // E12.0  [1] (🥻)       sari
                  // E11.0  [4] (🥼..🥿)    lab coat..flat shoe
                  // E1.0   [5] (🦀..🦄)    crab..unicorn
                  // E3.0  [13] (🦅..🦑)    eagle..squid
                  // E5.0   [6] (🦒..🦗)    giraffe..cricket
                  // E11.0 [11] (🦘..🦢)    kangaroo..swan
                  // E13.0  [2] (🦣..🦤)    mammoth..dodo
                  // E12.0  [6] (🦥..🦪)    sloth..oyster
                  // E13.0  [3] (🦫..🦭)    beaver..seal
                  // E12.0  [2] (🦮..🦯)    guide dog..white cane
                  // E11.0 [10] (🦰..🦹)    red hair..supervillain
                  // E12.0  [6] (🦺..🦿)    safety vest..mechanical leg
                  // E1.0   [1] (🧀)       cheese wedge
                  // E11.0  [2] (🧁..🧂)    cupcake..salt
                  // E12.0  [8] (🧃..🧊)    beverage box..ice
                  // E13.0  [1] (🧋)       bubble tea
                  // E14.0  [1] (🧌)       troll
                  // E12.0  [3] (🧍..🧏)    person standing..deaf person
                  // E5.0  [23] (🧐..🧦)    face with monocle..socks
                  // E11.0 [25] (🧧..🧿)    red envelope..nazar amulet
                  // E0.0 [112] (🨀..🩯)    NEUTRAL CHESS KING..<reserved-1FA6F>
                  // E12.0  [4] (🩰..🩳)    ballet shoes..shorts
                  // E13.0  [1] (🩴)       thong sandal
                  // E15.0  [3] (🩵..🩷)    light blue heart..pink heart
                  // E12.0  [3] (🩸..🩺)    drop of blood..stethoscope
                  // E14.0  [2] (🩻..🩼)    x-ray..crutch
                  // E0.0   [3] (🩽..🩿)    <reserved-1FA7D>..<reserved-1FA7F>
                  // E12.0  [3] (🪀..🪂)    yo-yo..parachute
                  // E13.0  [4] (🪃..🪆)    boomerang..nesting dolls
                  // E15.0  [2] (🪇..🪈)    maracas..flute
                  // E0.0   [7] (🪉..🪏)    <reserved-1FA89>..<reserved-1FA8F>
                  // E12.0  [6] (🪐..🪕)    ringed planet..banjo
                  // E13.0 [19] (🪖..🪨)    military helmet..rock
                  // E14.0  [4] (🪩..🪬)    mirror ball..hamsa
                  // E15.0  [3] (🪭..🪯)    folding hand fan..khanda
                  // E13.0  [7] (🪰..🪶)    fly..feather
                  // E14.0  [4] (🪷..🪺)    lotus..nest with eggs
                  // E15.0  [3] (🪻..🪽)    hyacinth..wing
                  // E0.0   [1] (🪾)       <reserved-1FABE>
                  // E15.0  [1] (🪿)       goose
                  // E13.0  [3] (🫀..🫂)    anatomical heart..people hugging
                  // E14.0  [3] (🫃..🫅)    pregnant man..person with crown
                  // E0.0   [8] (🫆..🫍)    <reserved-1FAC6>..<reserved-1FACD>
                  // E15.0  [2] (🫎..🫏)    moose..donkey
                  // E13.0  [7] (🫐..🫖)    blueberries..teapot
                  // E14.0  [3] (🫗..🫙)    pouring liquid..jar
                  // E15.0  [2] (🫚..🫛)    ginger root..pea pod
                  // E0.0   [4] (🫜..🫟)    <reserved-1FADC>..<reserved-1FADF>
                  // E14.0  [8] (🫠..🫧)    melting face..bubbles
                  // E15.0  [1] (🫨)       shaking face
                  // E0.0   [7] (🫩..🫯)    <reserved-1FAE9>..<reserved-1FAEF>
                  // E14.0  [7] (🫰..🫶)    hand with index finger and thumb crossed..heart hands
                  // E15.0  [2] (🫷..🫸)    leftwards pushing hand..rightwards pushing hand
                  // E0.0   [7] (🫹..🫿)    <reserved-1FAF9>..<reserved-1FAFF>
                  if (0x1f947 <= code && code <= 0x1faff) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                } else {
                  // E0.0[1022] (🰀..🿽)    <reserved-1FC00>..<reserved-1FFFD>
                  if (0x1fc00 <= code && code <= 0x1fffd) {
                    return boundaries_1.EXTENDED_PICTOGRAPHIC;
                  }
                }
              }
            }
          }
        }
      }
    }
    // unlisted code points are treated as a break property of "Other"
    return boundaries_1.CLUSTER_BREAK.OTHER;
  }
}
Graphemer$1.default = Graphemer;
var __importDefault = commonjsGlobal && commonjsGlobal.__importDefault || function (mod) {
  return mod && mod.__esModule ? mod : {
    "default": mod
  };
};
Object.defineProperty(lib, "__esModule", {
  value: true
});
const Graphemer_1 = __importDefault(Graphemer$1);
var _default = lib.default = Graphemer_1.default;

const tokenizeString = string => {
  // eslint-disable-next-line new-cap
  const splitter = new _default.default();
  return splitter.splitGraphemes(string);
};

const tokenizeUrlSearch = search => {
  // we don't use new URLSearchParams to preserve plus signs, see
  // see https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#preserving_plus_signs
  const params = search.slice(1).split("&");
  const paramsMap = new Map();
  for (const param of params) {
    let [urlSearchParamKey, urlSearchParamValue] = param.split("=");
    urlSearchParamKey = decodeURIComponent(urlSearchParamKey);
    urlSearchParamValue = decodeURIComponent(urlSearchParamValue);
    const existingUrlSearchParamValue = paramsMap.get(urlSearchParamKey);
    if (existingUrlSearchParamValue) {
      urlSearchParamValue = [...existingUrlSearchParamValue, urlSearchParamValue];
    } else {
      urlSearchParamValue = [urlSearchParamValue];
    }
    paramsMap.set(urlSearchParamKey, urlSearchParamValue);
  }
  return paramsMap;
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const wellKnownWeakMap = new WeakMap();
const numberWellKnownMap = new Map();
const symbolWellKnownMap = new Map();
const getWellKnownValuePath = value => {
  if (!wellKnownWeakMap.size) {
    visitValue(global, createValuePath());
    visitValue(AsyncFunction, createValuePath([{
      type: "identifier",
      value: "AsyncFunction"
    }]));
    visitValue(GeneratorFunction, createValuePath([{
      type: "identifier",
      value: "GeneratorFunction"
    }]));
    visitValue(AsyncGeneratorFunction, createValuePath([{
      type: "identifier",
      value: "AsyncGeneratorFunction"
    }]));
    for (const numberOwnPropertyName of Object.getOwnPropertyNames(Number)) {
      if (numberOwnPropertyName === "MAX_VALUE" || numberOwnPropertyName === "MIN_VALUE" || numberOwnPropertyName === "MAX_SAFE_INTEGER" || numberOwnPropertyName === "MIN_SAFE_INTEGER" || numberOwnPropertyName === "EPSILON") {
        numberWellKnownMap.set(Number[numberOwnPropertyName], [{
          type: "identifier",
          value: "Number"
        }, {
          type: "property_dot",
          value: "."
        }, {
          type: "property_identifier",
          value: numberOwnPropertyName
        }]);
      }
    }
    for (const mathOwnPropertyName of Object.getOwnPropertyNames(Math)) {
      if (mathOwnPropertyName === "E" || mathOwnPropertyName === "LN2" || mathOwnPropertyName === "LN10" || mathOwnPropertyName === "LOG2E" || mathOwnPropertyName === "LOG10E" || mathOwnPropertyName === "PI" || mathOwnPropertyName === "SQRT1_2" || mathOwnPropertyName === "SQRT2") {
        numberWellKnownMap.set(Math[mathOwnPropertyName], [{
          type: "identifier",
          value: "Math"
        }, {
          type: "property_dot",
          value: "."
        }, {
          type: "property_identifier",
          value: mathOwnPropertyName
        }]);
      }
    }
  }
  if (typeof value === "symbol") {
    return symbolWellKnownMap.get(value);
  }
  if (typeof value === "number") {
    return numberWellKnownMap.get(value);
  }
  return wellKnownWeakMap.get(value);
};
const AsyncFunction = async function () {}.constructor;
const GeneratorFunction = function* () {}.constructor;
const AsyncGeneratorFunction = async function* () {}.constructor;
const visitValue = (value, valuePath) => {
  if (typeof value === "symbol") {
    symbolWellKnownMap.set(value, valuePath);
    return;
  }
  if (!isComposite(value)) {
    return;
  }
  if (wellKnownWeakMap.has(value)) {
    // prevent infinite recursion on circular structures
    return;
  }
  wellKnownWeakMap.set(value, valuePath);
  const visitProperty = property => {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, property);
    } catch (e) {
      // may happen if you try to access some iframe properties or stuff like that
      if (e.name === "SecurityError") {
        return;
      }
      throw e;
    }
    if (!descriptor) {
      return;
    }
    // do not trigger getter/setter
    if ("value" in descriptor) {
      const propertyValue = descriptor.value;
      visitValue(propertyValue, valuePath.append(property));
    }
  };
  for (const property of Object.getOwnPropertyNames(value)) {
    visitProperty(property);
  }
  for (const symbol of Object.getOwnPropertySymbols(value)) {
    visitProperty(symbol);
  }
  if (isComposite(value)) {
    const protoValue = Object.getPrototypeOf(value);
    if (protoValue && !wellKnownWeakMap.has(protoValue)) {
      visitValue(protoValue, valuePath.append("__proto__"));
    }
  }
};

// under some rare and odd circumstances firefox Object.is(-0, -0)
// returns false making test fail.
// it is 100% reproductible with big.test.js.
// However putting debugger or executing Object.is just before the
// comparison prevent Object.is failure.
// It makes me thing there is something strange inside firefox internals.
// All this to say avoid relying on Object.is to test if the value is -0
const getIsNegativeZero = value => {
  return typeof value === "number" && 1 / value === -Infinity;
};

const groupDigits = digitsAsString => {
  const digitCount = digitsAsString.length;
  if (digitCount < 4) {
    return digitsAsString;
  }
  let digitsWithSeparator = digitsAsString.slice(-3);
  let remainingDigits = digitsAsString.slice(0, -3);
  while (remainingDigits.length) {
    const group = remainingDigits.slice(-3);
    remainingDigits = remainingDigits.slice(0, -3);
    digitsWithSeparator = "".concat(group, "_").concat(digitsWithSeparator);
  }
  return digitsWithSeparator;
};

// canParseDate can be called on any string
// so we want to be sure it's a date before handling it as such
// And Date.parse is super permissive
// see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// So we'll restrict permissivness
// A date like 1980/10/05 won't even be considered as a date

const canParseDate = value => {
  const dateParseResult = Date.parse(value);
  // eslint-disable-next-line no-self-compare
  if (dateParseResult !== dateParseResult) {
    return false;
  }
  // Iso format
  // "1995-12-04 00:12:00.000Z"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?([\+\-]\d{2}\:\d{2}|Z)?$/.test(value)) {
    return true;
  }

  // GMT format
  // "Tue May 07 2024 11:27:04 GMT+0200 (Central European Summer Time)",
  if (/^[a-zA-Z]{0,4} [a-z-A-Z]{0,4} [0-9]{2} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT([\+\-][0-9]{0,4})?( \((.*)\))?$/.test(value)) {
    return true;
  }
  // other format
  // "Thu, 01 Jan 1970 00:00:00"
  if (/^[a-zA-Z]{3}, [0-9]{2} [a-zA-Z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(value)) {
    return true;
  }
  return false;
};

/*
 * This file is named "scratch" as a testimony of the fact it has been
 * recoded from scratch around april 2024
 * - ansi in browser
 * - Blob, FormData, DataView, ArrayBuffer
 * - count diff + displayed diff ( + display in message?)
 * - add or removed reason must be unique
 */


// ANSI.supported = false;
const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectColor = ANSI.RED;
const expectColor = ANSI.GREEN;
/**
 * When a js value CANNOT EXISTS in actual or expect
 * the missing Node is set to PLACEHOLDER_FOR_NOTHING
 * For example,
 * - actual is a primitive, it cannot have properties
 * - expect is a composite, it can have properties
 * -> result into something like this
 * actual: true {
 *   <a>PLACEHOLDER_FOR_NOTHING
 * }
 * expect: {
 *   <a>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_FOR_NOTHING = {
  placeholder: "nothing"
};
/**
 * When a js value DOES NOT EXISTS ANYMORE in actual or expect
 * the missing Node is set to PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * For example,
 * - actual has 2 properties: "a" and "b"
 * - expect has 2 propertie: "a" and "c"
 * -> result into something like this
 * actual: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>ownPropertyDescriptorEntry,
 *   <c>PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * },
 * expect: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
 *   <c>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_WHEN_ADDED_OR_REMOVED = {
  placeholder: "added_or_removed"
};
const PLACEHOLDER_FOR_SAME = {
  placeholder: "same"
};
const PLACEHOLDER_FOR_MODIFIED = {
  placeholder: "modified"
};
const ARRAY_EMPTY_VALUE = {
  tag: "array_empty_value"
};
const SOURCE_CODE_ENTRY_KEY = {
  key: "[[source code]]"
};
const VALUE_OF_RETURN_VALUE_ENTRY_KEY = {
  key: "valueOf()"
};
const SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY = {
  key: "Symbol.toPrimitive()"
};
const setColor = (text, color) => {
  if (text.trim() === "") {
    // cannot set color of blank chars
    return text;
  }
  const textColored = ANSI.color(text, color);
  // if (color === ANSI.RED || color === ANSI.GREEN) {
  //   return ANSI.effect(textColored, ANSI.UNDERLINE);
  // }
  return textColored;
};
const defaultOptions = {
  actual: undefined,
  expect: undefined,
  MAX_DEPTH: 5,
  MAX_DEPTH_INSIDE_DIFF: 1,
  MAX_DIFF_INSIDE_VALUE: {
    prop: 2,
    line: 1
  },
  MAX_CONTEXT_BEFORE_DIFF: {
    prop: 2,
    line: 3
  },
  MAX_CONTEXT_AFTER_DIFF: {
    prop: 2,
    line: 3
  },
  MAX_COLUMNS: 100
};
const assert = (firstArg, ...rest) => {
  if (firstArg === undefined) {
    throw new TypeError("assert must be called with { actual, expect }, it was called without any argument");
  }
  if (rest.length) {
    throw new TypeError("assert must be called with { actual, expect }, it was called with too many arguments");
  }
  if (firstArg === null || typeof firstArg !== "object") {
    throw new TypeError("assert must be called with { actual, expect }, received ".concat(firstArg, " as first argument instead of object"));
  }
  if (!Object.hasOwn(firstArg, "actual")) {
    throw new TypeError("assert must be called with { actual, expect }, actual is missing");
  }
  if (!Object.hasOwn(firstArg, "expect")) {
    throw new TypeError("assert must be called with { actual, expect }, expect is missing");
  }
  const unexpectedParamNames = Object.keys(firstArg).filter(key => !Object.hasOwn(defaultOptions, key));
  if (unexpectedParamNames.length > 0) {
    throw new TypeError("\"".concat(unexpectedParamNames.join(","), "\": there is no such param"));
  }
  const {
    actual,
    expect,
    MAX_DEPTH,
    MAX_DEPTH_INSIDE_DIFF,
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF,
    MAX_COLUMNS
  } = {
    ...defaultOptions,
    ...firstArg
  };
  const actualRootNode = createRootNode({
    colorWhenSolo: addedColor,
    colorWhenSame: sameColor,
    colorWhenModified: unexpectColor,
    name: "actual",
    origin: "actual",
    value: actual,
    // otherValue: expect,
    render: renderValue
  });
  const expectRootNode = createRootNode({
    colorWhenSolo: removedColor,
    colorWhenSame: sameColor,
    colorWhenModified: expectColor,
    name: "expect",
    origin: "expect",
    value: expect,
    // otherValue: actual,
    render: renderValue
  });
  const causeSet = new Set();

  /*
   * Comparison are objects used to compare actualNode and expectNode
   * It is used to visit all the entry a js value can have
   * and progressively create a tree of node and comparison
   * as the visit progresses a diff is generated
   * In the process an other type of object is used called *Entry
   * The following entry exists:
   * - ownPropertyDescriptorEntry
   * - ownPropertySymbolEntry
   * - indexedEntry
   *   - array values
   *   - typed array values
   *   - string values
   * - internalEntry
   *   - url internal props
   *   - valueOf()
   *   - Symbol.toPrimitive()
   *   - function body
   *   - map keys and values
   *   - ....
   * Entry represent something that can be found in the js value
   * and can be associated with one or many node (js_value)
   * For example ownPropertyDescriptorEntry have 3 nodes:
   *   ownPropertyNameNode
   *   descriptorKeyNode
   *   descriptorValueNode
   */
  let isNot = false;
  const compare = (actualNode, expectNode) => {
    if (actualNode.ignore && actualNode.comparison) {
      return actualNode.comparison;
    }
    if (expectNode.ignore && expectNode.comparison) {
      return expectNode.comparison;
    }
    const reasons = createReasons();
    const comparison = {
      actualNode,
      expectNode,
      reasons,
      done: false
    };
    if (!actualNode.placeholder) {
      actualNode.otherNode = expectNode;
    }
    if (!expectNode.placeholder) {
      expectNode.otherNode = actualNode;
    }
    const onSelfDiff = reason => {
      reasons.self.modified.add(reason);
      causeSet.add(comparison);
    };
    const onAdded = reason => {
      reasons.self.added.add(reason);
      causeSet.add(comparison);
    };
    const onRemoved = reason => {
      reasons.self.removed.add(reason);
      causeSet.add(comparison);
    };
    const subcompareDuo = (actualChildNode, expectChildNode, {
      revertNot
    } = {}) => {
      let isNotPrevious = isNot;
      if (revertNot) {
        isNot = !isNot;
      }
      const childComparison = compare(actualChildNode, expectChildNode);
      isNot = isNotPrevious;
      appendReasonGroup(comparison.reasons.inside, childComparison.reasons.overall);
      return childComparison;
    };
    const subcompareSolo = (childNode, placeholderNode, compareOptions) => {
      if (childNode.name === "actual") {
        return subcompareDuo(childNode, placeholderNode, compareOptions);
      }
      return subcompareDuo(placeholderNode, childNode, compareOptions);
    };
    const subcompareChildrenDuo = (actualNode, expectNode) => {
      const isSetEntriesComparison = actualNode.subgroup === "set_entries" && expectNode.subgroup === "set_entries";
      const childComparisonMap = new Map();
      const childComparisonDiffMap = new Map();
      {
        const actualChildrenKeys = [];
        let actualFirstChildWithDiffKey;
        for (let [childKey, actualChildNode] of actualNode.childNodeMap) {
          let expectChildNode;
          if (isSetEntriesComparison) {
            const actualSetValueNode = actualChildNode;
            for (const [, expectSetValueNode] of expectNode.childNodeMap) {
              if (expectSetValueNode.value === actualSetValueNode.value) {
                expectChildNode = expectSetValueNode;
                break;
              }
            }
          } else {
            expectChildNode = expectNode.childNodeMap.get(childKey);
          }
          if (actualChildNode && expectChildNode) {
            const childComparison = subcompareDuo(actualChildNode, expectChildNode);
            childComparisonMap.set(childKey, childComparison);
            if (childComparison.hasAnyDiff) {
              childComparisonDiffMap.set(childKey, childComparison);
            }
            if (!actualChildNode.isHidden) {
              actualChildrenKeys.push(childKey);
              if (childComparison.hasAnyDiff && actualFirstChildWithDiffKey === undefined) {
                actualFirstChildWithDiffKey = childKey;
              }
            }
            continue;
          }
          const addedChildComparison = subcompareSolo(actualChildNode, PLACEHOLDER_WHEN_ADDED_OR_REMOVED);
          childComparisonMap.set(childKey, addedChildComparison);
          childComparisonDiffMap.set(childKey, addedChildComparison);
          if (!actualChildNode.isHidden) {
            actualChildrenKeys.push(childKey);
            if (actualFirstChildWithDiffKey === undefined) {
              actualFirstChildWithDiffKey = childKey;
            }
          }
        }
        actualNode.childrenKeys = actualChildrenKeys;
        actualNode.firstChildWithDiffKey = actualFirstChildWithDiffKey;
      }
      {
        const expectChildrenKeys = [];
        let expectFirstChildWithDiffKey;
        for (let [childKey, expectChildNode] of expectNode.childNodeMap) {
          if (isSetEntriesComparison) {
            const expectSetValueNode = expectChildNode;
            let hasEntry;
            for (const [, actualSetValueNode] of actualNode.childNodeMap) {
              if (actualSetValueNode.value === expectSetValueNode.value) {
                hasEntry = true;
                break;
              }
            }
            if (hasEntry) {
              if (!expectChildNode.isHidden) {
                expectChildrenKeys.push(childKey);
              }
              continue;
            }
          } else {
            const childComparison = childComparisonMap.get(childKey);
            if (childComparison) {
              if (!expectChildNode.isHidden) {
                expectChildrenKeys.push(childKey);
                if (childComparison.hasAnyDiff && expectFirstChildWithDiffKey === undefined) {
                  expectFirstChildWithDiffKey = childKey;
                }
              }
              continue;
            }
          }
          const removedChildComparison = subcompareSolo(expectChildNode, PLACEHOLDER_WHEN_ADDED_OR_REMOVED);
          childComparisonMap.set(childKey, removedChildComparison);
          childComparisonDiffMap.set(childKey, removedChildComparison);
          if (!expectChildNode.isHidden) {
            expectChildrenKeys.push(childKey);
            if (expectFirstChildWithDiffKey === undefined) {
              expectFirstChildWithDiffKey = childKey;
            }
          }
        }
        expectNode.childrenKeys = expectChildrenKeys;
        expectNode.firstChildWithDiffKey = expectFirstChildWithDiffKey;
      }
      actualNode.childComparisonDiffMap = childComparisonDiffMap;
      expectNode.childComparisonDiffMap = childComparisonDiffMap;
    };
    const subcompareChildrenSolo = (node, placeholderNode) => {
      const childComparisonDiffMap = new Map();
      const childrenKeys = [];
      let firstChildWithDiffKey;
      for (const [childKey, childNode] of node.childNodeMap) {
        const soloChildComparison = subcompareSolo(childNode, placeholderNode);
        if (placeholderNode !== PLACEHOLDER_FOR_SAME) {
          childComparisonDiffMap.set(childKey, soloChildComparison);
        }
        if (!childNode.isHidden) {
          childrenKeys.push(childKey);
          if (placeholderNode !== PLACEHOLDER_FOR_SAME && firstChildWithDiffKey === undefined) {
            firstChildWithDiffKey = childKey;
          }
        }
      }
      node.childrenKeys = childrenKeys;
      node.firstChildWithDiffKey = firstChildWithDiffKey;
      node.childComparisonDiffMap = childComparisonDiffMap;
    };
    const visitDuo = (actualNode, expectNode) => {
      if (actualNode.comparison) {
        throw new Error("actualNode (".concat(actualNode.subgroup, ") already compared"));
      }
      actualNode.comparison = comparison;
      if (expectNode.comparison) {
        throw new Error("expectNode (".concat(expectNode.subgroup, ") already compared"));
      }
      expectNode.comparison = comparison;
      const {
        result,
        reason,
        propagate
      } = comparerDefault(actualNode, expectNode);
      if (result === "failure") {
        onSelfDiff(reason);
        if (propagate) {
          subcompareChildrenSolo(actualNode, propagate);
          subcompareChildrenSolo(expectNode, propagate);
          return;
        }
        subcompareChildrenDuo(actualNode, expectNode);
        return;
      }
      if (result === "success") {
        if (propagate) {
          const actualRender = actualNode.render;
          const expectRender = expectNode.render;
          actualNode.render = props => {
            actualNode.render = actualRender;
            // expectNode.render = expectRender;
            subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_SAME);
            return actualRender(props);
          };
          expectNode.render = props => {
            // actualNode.render = actualRender;
            expectNode.render = expectRender;
            subcompareChildrenSolo(expectNode, PLACEHOLDER_FOR_SAME);
            return expectRender(props);
          };
          if (actualNode.isHiddenWhenSame) {
            actualNode.isHidden = true;
          }
          if (expectNode.isHiddenWhenSame) {
            expectNode.isHidden = true;
          }
          return;
        }
        subcompareChildrenDuo(actualNode, expectNode);
        return;
      }
      subcompareChildrenDuo(actualNode, expectNode);
      if (
      // is root comparison between numbers?
      actualNode.subgroup === "number_composition" && actualNode.parent.parent === null && expectNode.parent.parent === null) {
        const actualIntegerNode = actualNode.childNodeMap.get("integer");
        const expectIntegerNode = expectNode.childNodeMap.get("integer");
        if (actualIntegerNode && expectIntegerNode) {
          if (actualNode.parent.isInfinity === expectNode.parent.isInfinity) {
            const actualSignNode = actualNode.childNodeMap.get("sign");
            const expectSignNode = expectNode.childNodeMap.get("sign");
            let actualWidth = actualIntegerNode.value.length;
            let expectWidth = expectIntegerNode.value.length;
            if (actualSignNode) {
              actualWidth += "-".length;
            }
            if (expectSignNode) {
              expectWidth += "-".length;
            }
            const diff = Math.abs(expectWidth - actualWidth);
            if (diff < 10) {
              if (actualWidth < expectWidth) {
                actualNode.startMarker = " ".repeat(expectWidth - actualWidth);
              } else if (actualWidth > expectWidth) {
                expectNode.startMarker = " ".repeat(actualWidth - expectWidth);
              }
            }
          }
        }
      }
    };
    const visitSolo = (node, placeholderNode) => {
      if (node.comparison) {
        throw new Error("node (".concat(node.subgroup, ") already compared"));
      }
      node.comparison = comparison;
      if (node.isHiddenWhenSolo) {
        node.isHidden = true;
      }
      subcompareChildrenSolo(node, placeholderNode);
    };
    visit: {
      if (actualNode.category === expectNode.category) {
        visitDuo(actualNode, expectNode);
        break visit;
      }
      // not found in expect (added or expect cannot have this type of value)
      if (actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED || actualNode === PLACEHOLDER_FOR_NOTHING) {
        visitSolo(expectNode, actualNode);
        onRemoved(getAddedOrRemovedReason(expectNode));
        break visit;
      }
      // not found in actual (removed or actual cannot have this type of value)
      if (expectNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED || expectNode === PLACEHOLDER_FOR_NOTHING) {
        visitSolo(actualNode, expectNode);
        onAdded(getAddedOrRemovedReason(actualNode));
        break visit;
      }
      // force actual to be same/modified
      if (actualNode === PLACEHOLDER_FOR_SAME || actualNode === PLACEHOLDER_FOR_MODIFIED) {
        visitSolo(expectNode, actualNode);
        break visit;
      }
      // force expect to be same/modified
      if (expectNode === PLACEHOLDER_FOR_SAME || expectNode === PLACEHOLDER_FOR_MODIFIED) {
        visitSolo(actualNode, expectNode);
        break visit;
      }
      // custom comparison
      if (actualNode.category === "primitive" || actualNode.category === "composite") {
        if (expectNode.customCompare) {
          expectNode.customCompare(actualNode, expectNode, {
            subcompareChildrenDuo,
            subcompareChildrenSolo,
            subcompareDuo,
            subcompareSolo,
            onSelfDiff
          });
          break visit;
        }
      }

      // not same category
      onSelfDiff("should_be_".concat(expect.category));
      // primitive expect
      if (expectNode.category === "primitive" && actualNode.category === "composite") {
        const actualAsPrimitiveNode = asPrimitiveNode(actualNode);
        if (actualAsPrimitiveNode) {
          subcompareDuo(actualAsPrimitiveNode, expectNode);
          actualAsPrimitiveNode.ignore = true;
          visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
          break visit;
        }
      }
      // composite expect
      else if (expectNode.category === "composite" && actualNode.category === "primitive") {
        const expectAsPrimitiveNode = asPrimitiveNode(expectNode);
        if (expectAsPrimitiveNode) {
          subcompareDuo(actualNode, expectAsPrimitiveNode);
          expectAsPrimitiveNode.ignore = true;
          visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
          break visit;
        }
      }
      visitSolo(actualNode, PLACEHOLDER_FOR_NOTHING);
      visitSolo(expectNode, PLACEHOLDER_FOR_NOTHING);
    }
    const {
      self,
      inside,
      overall
    } = comparison.reasons;
    appendReasons(self.any, self.modified, self.removed, self.added);
    appendReasons(inside.any, inside.modified, inside.removed, inside.added);
    appendReasons(overall.removed, self.removed, inside.removed);
    appendReasons(overall.added, self.added, inside.added);
    appendReasons(overall.modified, self.modified, inside.modified);
    appendReasons(overall.any, self.any, inside.any);
    comparison.selfHasRemoval = self.removed.size > 0;
    comparison.selfHasAddition = self.added.size > 0;
    comparison.selfHasModification = self.modified.size > 0;
    comparison.hasAnyDiff = overall.any.size > 0;
    comparison.done = true;
    const updateNodeDiffType = (node, otherNode) => {
      if (node.diffType !== "") {
        return;
      }
      let diffType = "";
      if (otherNode === PLACEHOLDER_FOR_NOTHING) {
        diffType = "modified";
      } else if (otherNode === PLACEHOLDER_FOR_MODIFIED) {
        diffType = "modified";
      } else if (otherNode === PLACEHOLDER_FOR_SAME) {
        diffType = "same";
      } else if (otherNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
        diffType = "solo";
      } else if (comparison.selfHasModification) {
        diffType = "modified";
      } else {
        diffType = "same";
      }
      node.diffType = diffType;
      if (isNot) {
        node.color = node.colorWhenSame;
      } else {
        node.color = {
          solo: node.colorWhenSolo,
          modified: node.colorWhenModified,
          same: node.colorWhenSame
        }[diffType];
      }
    };
    updateNodeDiffType(actualNode, expectNode);
    updateNodeDiffType(expectNode, actualNode);
    if (comparison.reasons.overall.any.size === 0) {
      if (actualNode.isHiddenWhenSame) {
        actualNode.isHidden = true;
      }
      if (expectNode.isHiddenWhenSame) {
        expectNode.isHidden = true;
      }
    }
    if (actualNode.subgroup === "line_entries" && expectNode.subgroup === "line_entries") {
      const actualIsMultiline = actualNode.childNodeMap.size > 1;
      const expectIsMultiline = expectNode.childNodeMap.size > 1;
      if (actualIsMultiline && !expectIsMultiline) {
        enableMultilineDiff(expectNode);
      } else if (!actualIsMultiline && expectIsMultiline) {
        enableMultilineDiff(actualNode);
      } else if (!actualIsMultiline && !expectIsMultiline) {
        forceSameQuotes(actualNode, expectNode);
      }
    }
    if (actualNode.subgroup === "url_parts" && expectNode.subgroup === "url_parts") {
      forceSameQuotes(actualNode, expectNode);
    }
    return comparison;
  };
  const rootComparison = compare(actualRootNode, expectRootNode);
  if (!rootComparison.hasAnyDiff) {
    return;
  }
  let diff = "";
  const infos = [];
  let actualStartNode;
  let expectStartNode;
  start_on_max_depth: {
    if (rootComparison.selfHasModification) {
      actualStartNode = actualRootNode;
      expectStartNode = expectRootNode;
      break start_on_max_depth;
    }
    const getStartNode = rootNode => {
      let topMostNodeWithDiff = null;
      for (const comparisonWithDiff of causeSet) {
        const node = comparisonWithDiff[rootNode.name === "actual" ? "actualNode" : "expectNode"];
        if (!topMostNodeWithDiff || node.depth < topMostNodeWithDiff.depth) {
          topMostNodeWithDiff = node;
        }
      }
      if (topMostNodeWithDiff.depth < MAX_DEPTH) {
        return rootNode;
      }
      let currentNode = topMostNodeWithDiff;
      let startDepth = topMostNodeWithDiff.depth - MAX_DEPTH;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const parentNode = currentNode.parent;
        if (!parentNode) {
          return rootNode;
        }
        if (!parentNode.isContainer && parentNode.depth === startDepth) {
          return parentNode;
        }
        currentNode = parentNode;
      }
    };
    actualStartNode = getStartNode(actualRootNode);
    expectStartNode = getStartNode(expectRootNode);
    if (actualStartNode !== actualRootNode && expectStartNode !== expectRootNode) {
      const actualStartNodePath = actualStartNode.path.toString();
      const expectStartNodePath = expectStartNode.path.toString();
      if (actualStartNodePath === expectStartNodePath) {
        infos.push("diff starts at ".concat(ANSI.color(actualStartNodePath, ANSI.YELLOW)));
      } else {
        infos.push("actual diff starts at ".concat(ANSI.color(actualStartNodePath, ANSI.YELLOW)));
        infos.push("expect diff starts at ".concat(ANSI.color(expectStartNodePath, ANSI.YELLOW)));
      }
    } else if (actualStartNode !== actualRootNode) {
      infos.push("actual diff starts at ".concat(ANSI.color(actualStartNode.path, ANSI.YELLOW)));
    } else if (expectStartNode !== expectRootNode) {
      infos.push("expect diff starts at ".concat(ANSI.color(expectStartNode.path, ANSI.YELLOW)));
    }
  }
  if (infos.length) {
    for (const info of infos) {
      diff += "".concat(UNICODE.INFO, " ").concat(info);
      diff += "\n";
    }
    diff += "\n";
  }
  diff += ANSI.color("actual:", sameColor);
  diff += " ";
  diff += actualStartNode.render({
    MAX_DEPTH,
    MAX_DEPTH_INSIDE_DIFF,
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF,
    MAX_COLUMNS,
    columnsRemaining: MAX_COLUMNS - "actual: ".length,
    startNode: actualStartNode
  });
  diff += "\n";
  diff += ANSI.color("expect:", sameColor);
  diff += " ";
  diff += expectStartNode.render({
    MAX_DEPTH,
    MAX_DEPTH_INSIDE_DIFF,
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF,
    MAX_COLUMNS,
    columnsRemaining: MAX_COLUMNS - "expect: ".length,
    startNode: expectStartNode
  });
  throw assert.createAssertionError(diff);
};
assert.createAssertionError = message => {
  const error = new Error(message);
  error.name = "AssertionError";
  return error;
};
assert.isAssertionError = value => {
  if (!value) return false;
  if (typeof value !== "object") return false;
  if (value.name === "AssertionError") return true;
  if (value.name.includes("AssertionError")) return true;
  return false;
};
const comparerDefault = (actualNode, expectNode) => {
  if (actualNode.category === "primitive" || actualNode.category === "line_parts" || actualNode.category === "date_parts" || actualNode.category === "url_parts" || actualNode.category === "header_value_parts") {
    if (actualNode.value === expectNode.value && actualNode.isNegativeZero === expectNode.isNegativeZero) {
      return {
        result: "success",
        propagate: PLACEHOLDER_FOR_SAME
      };
    }
    if (actualNode.category === "primitive") {
      return {
        result: "failure",
        reason: "primitive_value",
        // Some primitive have children to render (like numbers)
        // when comparison a boolean and a number for instance
        // all number children will be colored in yellow because
        // they have no counterparts as boolean node
        // What we want instead is to color the number children in red/green
        propagate: typeof actualNode.value === typeof expectNode.value ? null : PLACEHOLDER_FOR_MODIFIED
      };
    }
    return {
      result: ""
    };
  }
  if (actualNode.category === "composite") {
    if (actualNode.value === expectNode.value) {
      return {
        result: "success",
        propagate: PLACEHOLDER_FOR_SAME
      };
    }
    return {
      result: ""
    };
  }
  if (actualNode.category === "reference") {
    const actualRefPathString = actualNode.value.pop().toString();
    const expectRefPathString = expectNode.value.pop().toString();
    if (actualRefPathString !== expectRefPathString) {
      return {
        result: "failure",
        reason: "ref_path",
        propagate: PLACEHOLDER_FOR_MODIFIED
      };
    }
    return {
      result: "success",
      propagate: PLACEHOLDER_FOR_SAME
    };
  }
  if (actualNode.category === "entries") {
    if (actualNode.multilineDiff && expectNode.multilineDiff && actualNode.multilineDiff.hasMarkersWhenEmpty !== expectNode.multilineDiff.hasMarkersWhenEmpty) {
      actualNode.multilineDiff.hasMarkersWhenEmpty = expectNode.multilineDiff.hasMarkersWhenEmpty = true;
    }
    if (actualNode.onelineDiff && expectNode.onelineDiff && actualNode.onelineDiff.hasMarkersWhenEmpty !== expectNode.onelineDiff.hasMarkersWhenEmpty) {
      actualNode.onelineDiff.hasMarkersWhenEmpty = expectNode.onelineDiff.hasMarkersWhenEmpty = true;
    }
    return {
      result: ""
    };
  }
  return {
    result: ""
  };
};
const customExpectationSymbol = Symbol.for("jsenv_assert_custom_expectation");
const createCustomExpectation = (name, props) => {
  return {
    [Symbol.toStringTag]: name,
    [customExpectationSymbol]: true,
    group: "custom_expectation",
    subgroup: name,
    ...props
  };
};
const createAssertMethodCustomExpectation = (methodName, args, {
  customCompare = createAssertMethodCustomCompare((actualNode, expectArgValueNode, {
    subcompareDuo
  }) => {
    const expectArgComparison = subcompareDuo(actualNode, expectArgValueNode);
    return expectArgComparison.hasAnyDiff ? PLACEHOLDER_FOR_MODIFIED : PLACEHOLDER_FOR_SAME;
  }),
  renderOnlyArgs
} = {}) => {
  return createCustomExpectation("assert.".concat(methodName), {
    parse: node => {
      node.childGenerator = () => {
        node.appendChild("assert_method_call", createMethodCallNode(node, {
          objectName: "assert",
          methodName,
          args,
          renderOnlyArgs
        }));
      };
    },
    customCompare,
    render: (node, props) => {
      let diff = "";
      const assertMethodCallNode = node.childNodeMap.get("assert_method_call");
      if (renderOnlyArgs) {
        const argEntriesNode = assertMethodCallNode.childNodeMap.get("args");
        argEntriesNode.startMarker = "";
        argEntriesNode.endMarker = "";
        diff += argEntriesNode.render(props);
      } else {
        diff += assertMethodCallNode.render(props);
      }
      return diff;
    }
  });
};
const createValueCustomCompare = customComparer => {
  return (actualNode, expectNode, {
    onSelfDiff,
    subcompareChildrenSolo
  }) => {
    const selfDiff = customComparer(actualNode, expectNode);
    if (selfDiff) {
      onSelfDiff(selfDiff);
      subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_MODIFIED);
      return;
    }
    subcompareChildrenSolo(actualNode, PLACEHOLDER_FOR_SAME);
  };
};
const createAssertMethodCustomCompare = (customComparer, {
  argsCanBeComparedInParallel
} = {}) => {
  return (actualNode, expectNode, options) => {
    // prettier-ignore
    const assertMethod = expectNode.childNodeMap.get("assert_method_call");
    const argEntriesNode = assertMethod.childNodeMap.get("args");
    const childNodeKeys = Array.from(argEntriesNode.childNodeMap.keys());
    if (childNodeKeys.length === 0) {
      return;
    }
    if (childNodeKeys.length === 1) {
      const expectFirsArgValueNode = argEntriesNode.childNodeMap.get(0);
      expectFirsArgValueNode.ignore = true;
      const customComparerResult = customComparer(actualNode, expectFirsArgValueNode, options);
      options.subcompareSolo(expectNode, customComparerResult);
      return;
    }
    const argIterator = argEntriesNode.childNodeMap[Symbol.iterator]();
    function* argValueGenerator() {
      let argIteratorResult;
      while (argIteratorResult = argIterator.next()) {
        if (argIteratorResult.done) {
          break;
        }
        yield argIteratorResult.value[1];
      }
    }
    let result = PLACEHOLDER_FOR_SAME;
    for (const argValueNode of argValueGenerator()) {
      argValueNode.ignore = true;
      const customComparerResult = customComparer(actualNode, argValueNode, options);
      if (customComparerResult === PLACEHOLDER_FOR_SAME) {
        continue;
      }
      result = customComparerResult;
      if (argsCanBeComparedInParallel) {
        continue;
      }
      for (const remainingArgValueNode of argValueGenerator()) {
        remainingArgValueNode.ignore = true;
        options.subcompareSolo(customComparerResult, remainingArgValueNode);
      }
      break;
    }
    options.subcompareSolo(expectNode, result);
    return;
  };
};
assert.belowOrEquals = (value, {
  renderOnlyArgs
} = {}) => {
  if (typeof value !== "number") {
    throw new TypeError("assert.belowOrEquals 1st argument must be number, received ".concat(value));
  }
  return createAssertMethodCustomExpectation("belowOrEquals", [{
    value,
    customCompare: createValueCustomCompare(actualNode => {
      if (!actualNode.isNumber) {
        return "should_be_a_number";
      }
      if (actualNode.value > value) {
        return "should_be_below_or_equals_to_".concat(value);
      }
      return null;
    })
  }], {
    renderOnlyArgs
  });
};
assert.aboveOrEquals = (value, {
  renderOnlyArgs
} = {}) => {
  if (typeof value !== "number") {
    throw new TypeError("assert.aboveOrEquals 1st argument must be number, received ".concat(value));
  }
  return createAssertMethodCustomExpectation("aboveOrEquals", [{
    value,
    customCompare: createValueCustomCompare(actualNode => {
      if (!actualNode.isNumber) {
        return "should_be_a_number";
      }
      if (actualNode.value < value) {
        return "should_be_greater_or_equals_to_".concat(value);
      }
      return null;
    })
  }], {
    renderOnlyArgs
  });
};
assert.between = (minValue, maxValue) => {
  if (typeof minValue !== "number") {
    throw new TypeError("assert.between 1st argument must be number, received ".concat(minValue));
  }
  if (typeof maxValue !== "number") {
    throw new TypeError("assert.between 2nd argument must be number, received ".concat(maxValue));
  }
  if (minValue > maxValue) {
    throw new Error("assert.between 1st argument is > 2nd argument, ".concat(minValue, " > ").concat(maxValue));
  }
  return createAssertMethodCustomExpectation("between", [{
    value: assert.aboveOrEquals(minValue, {
      renderOnlyArgs: true
    })
  }, {
    value: assert.belowOrEquals(maxValue, {
      renderOnlyArgs: true
    })
  }]);
};
assert.not = value => {
  return createAssertMethodCustomExpectation("not", [{
    value
  }], {
    customCompare: createAssertMethodCustomCompare((actualNode, expectFirsArgValueNode, {
      subcompareDuo,
      onSelfDiff
    }) => {
      const expectFirstArgComparison = subcompareDuo(actualNode, expectFirsArgValueNode, {
        revertNot: true
      });
      if (expectFirstArgComparison.hasAnyDiff) {
        // we should also "revert" side effects of all diff inside expectAsNode
        // - adding to causeSet
        // - colors (should be done during comparison)
        return PLACEHOLDER_FOR_SAME;
      }
      onSelfDiff("sould_have_diff");
      return PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
    })
  });
};
assert.any = constructor => {
  if (typeof constructor !== "function") {
    throw new TypeError("assert.any 1st argument must be a function, received ".concat(constructor));
  }
  const constructorName = constructor.name;
  return createAssertMethodCustomExpectation("any", [{
    value: constructor,
    customCompare: createValueCustomCompare(constructorName ? actualNode => {
      for (const proto of objectPrototypeChainGenerator(actualNode.value)) {
        const protoConstructor = proto.constructor;
        if (protoConstructor.name === constructorName) {
          return null;
        }
      }
      return "should_have_constructor_".concat(constructorName);
    } : actualNode => {
      for (const proto of objectPrototypeChainGenerator(actualNode.value)) {
        const protoConstructor = proto.constructor;
        if (protoConstructor === constructor) {
          return null;
        }
      }
      return "should_have_constructor_".concat(constructor.toString());
    })
  }]);
};
assert.startsWith = string => {
  if (typeof string !== "string") {
    throw new TypeError("assert.startsWith 1st argument must be a string, received ".concat(string));
  }
  return createAssertMethodCustomExpectation("startsWith", [{
    value: string,
    customCompare: createValueCustomCompare(actualNode => {
      if (!actualNode.iString) {
        return "should_be_a_string";
      }
      if (!actualNode.value.startsWith(string)) {
        return "should_start_with_".concat(string);
      }
      return null;
    })
  }]);
};
assert.closeTo = (float, precision = 2) => {
  if (typeof float !== "number") {
    throw new TypeError("assert.closeTo 1st argument must be a number, received ".concat(float));
  }
  return createAssertMethodCustomExpectation("closeTo", [{
    value: float,
    customCompare: createValueCustomCompare(actualNode => {
      if (!actualNode.isNumber) {
        return "should_be_a_number";
      }
      const actual = actualNode.value;
      if (actual === Infinity && float === Infinity) {
        return null;
      }
      if (actual === -Infinity && float === -Infinity) {
        return null;
      }
      const expectedDiff = Math.pow(10, -precision) / 2;
      const receivedDiff = Math.abs(float - actual);
      if (receivedDiff > expectedDiff) {
        return "should_be_close_to_".concat(float);
      }
      return null;
    })
  }]);
};
assert.matches = regexp => {
  if (typeof regexp !== "object") {
    throw new TypeError("assert.matches 1st argument must be a regex, received ".concat(regexp));
  }
  return createAssertMethodCustomExpectation("matches", [{
    value: regexp,
    customCompare: createValueCustomCompare(actualNode => {
      if (!actualNode.isString) {
        return "should_be_a_string";
      }
      const actual = actualNode.value;
      if (!regexp.test(actual)) {
        return "should_match_".concat(regexp);
      }
      return null;
    })
  }]);
};
let createRootNode;
/*
 * Node represent any js value.
 * These js value are compared and converted to a readable string
 * Node art part of a tree structure (parent/children) and contains many
 * information about the value such as
 * - Is it a primitive or a composite?
 * - Where does the value come from?
 *   - property key
 *   - property value
 *   - prototype value returned by Object.getPrototypeOf()
 *   - a map entry key
 * - And finally info useful to render the js value into a readable string
 */
{
  createRootNode = ({
    colorWhenSolo,
    colorWhenSame,
    colorWhenModified,
    name,
    value,
    render
  }) => {
    /*
     * Il est possible pour actual de ref des valeurs de expect et inversement tel que
     * - Object.prototype
     * - Un ancetre commun
     * - Peu importe en fait
     * Il est aussi possible de découvrir une ref dans l'un plus tot que dans l'autre
     * (l'ordre des prop des object n'est pas garanti nottament)
     * Pour cette raison il y a un referenceMap par arbre (actual/expect)
     * Au final on regardera juste le path ou se trouve une ref pour savoir si elle sont les meme
     *
     * Une ref peut etre découverte apres
     * - ordre des props
     * - caché par maxColumns
     * - caché par MAX_ENTRY_BEFORE_MULTILINE_DIFF
     * - ...
     * Et que la découverte lazy des child (childGenerator) ne garantie pas de trouver la ref
     * des le départ
     * ALORS
     * On ne peut pas utiliser la notation suivante:
     * actual: {
     *   a: <ref #1> { toto: true },
     *   b: <ref #1>
     * }
     * expect: {
     *   a: <ref #1> { toto: true },
     *   b: <ref #1>
     * }
     *
     * on va lui préférer:
     * actual: {
     *   a: { toto: true },
     *   b: actual.a,
     * }
     * expect: {
     *   a: { toto: true },
     *   b: expect.a,
     * }
     */

    const referenceMap = new Map();
    let nodeId = 1;
    const rootNode = createNode({
      id: nodeId,
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      group: "root",
      value,
      parent: null,
      depth: 0,
      path: createValuePath([{
        type: "identifier",
        value: name
      }]),
      render,
      referenceMap,
      nextId: () => {
        nodeId++;
        return nodeId;
      }
    });
    return rootNode;
  };
  const createNode = ({
    colorWhenSolo,
    colorWhenSame,
    colorWhenModified,
    name,
    group,
    subgroup = group,
    category = group,
    value,
    key,
    parent,
    referenceMap,
    nextId,
    depth,
    path,
    childGenerator,
    isSourceCode = false,
    isFunctionPrototype = false,
    isClassPrototype = false,
    isRegexpSource = false,
    isStringForUrl = false,
    isStringForDate = false,
    isBody = false,
    customCompare,
    render,
    isHidden = false,
    isHiddenWhenSame = false,
    isHiddenWhenSolo = false,
    focusedChildIndex,
    startMarker = "",
    endMarker = "",
    quoteMarkerRef,
    separatorMarker = "",
    separatorMarkerDisabled = false,
    separatorMarkerWhenTruncated,
    hasLeftSpacingDisabled = false,
    hasRightSpacingDisabled = false,
    quotesDisabled = false,
    quotesBacktickDisabled = false,
    numericSeparatorsDisabled = false,
    lineNumbersDisabled = false,
    urlStringDetectionDisabled = false,
    dateStringDetectionDisabled = false,
    preserveLineBreaks = false,
    renderOptions = renderOptionsDefault,
    onelineDiff = null,
    multilineDiff = null,
    stringDiffPrecision = "per_line_and_per_char"
  }) => {
    const node = {
      colorWhenSolo,
      colorWhenSame,
      colorWhenModified,
      name,
      value,
      key,
      group,
      subgroup,
      category,
      childGenerator,
      childNodeMap: null,
      appendChild: (childKey, params) => appendChildNodeGeneric(node, childKey, params),
      wrappedNodeGetter: () => {},
      parent,
      reference: null,
      referenceMap,
      nextId,
      depth,
      path,
      isSourceCode,
      isClassPrototype,
      isRegexpSource,
      isStringForUrl,
      isStringForDate,
      isBody,
      // info
      isCustomExpectation: false,
      // info/primitive
      isUndefined: false,
      isString: false,
      isNumber: false,
      isNegativeZero: false,
      isInfinity: false,
      isNaN: false,
      isBigInt: false,
      isSymbol: false,
      // info/composite
      isFunction: false,
      functionAnalysis: defaultFunctionAnalysis,
      objectTag: "",
      isArray: false,
      isTypedArray: false,
      isMap: false,
      isSet: false,
      isURL: false,
      isURLSearchParams: false,
      isHeaders: false,
      isDate: false,
      isError: false,
      isRegExp: false,
      isPromise: false,
      isRequest: false,
      isResponse: false,
      isAbortController: false,
      isAbortSignal: false,
      isStringObject: false,
      referenceFromOthersSet: referenceFromOthersSetDefault,
      // render info
      render: props => render(node, props),
      isHidden,
      isHiddenWhenSame,
      isHiddenWhenSolo,
      focusedChildIndex,
      beforeRender: null,
      // START will be set by comparison
      customCompare,
      ignore: false,
      comparison: null,
      childComparisonDiffMap: null,
      childrenKeys: null,
      childrenRenderRange: null,
      firstChildWithDiffKey: undefined,
      rangeToDisplay: null,
      displayedRange: null,
      diffType: "",
      otherNode: null,
      // END will be set by comparison
      startMarker,
      endMarker,
      quoteMarkerRef,
      separatorMarker,
      separatorMarkerDisabled,
      separatorMarkerWhenTruncated,
      hasLeftSpacingDisabled,
      hasRightSpacingDisabled,
      renderOptions,
      onelineDiff,
      multilineDiff,
      color: ""
    };
    {
      const childNodeMap = new Map();
      let childrenGenerated = false;
      const generateChildren = () => {
        if (childrenGenerated) {
          return;
        }
        childrenGenerated = true;
        if (!node.childGenerator) {
          return;
        }
        node.childGenerator(node);
        node.childGenerator = null;
      };
      node.childNodeMap = new Proxy(childNodeMap, {
        has: (target, prop, receiver) => {
          if (!childrenGenerated) {
            generateChildren();
          }
          let value = Reflect.has(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
        get: (target, prop, receiver) => {
          if (!childrenGenerated) {
            generateChildren();
          }
          if (prop === "size") {
            return target[prop];
          }
          let value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
    }
    Object.preventExtensions(node);
    if (value && value[customExpectationSymbol]) {
      const {
        parse,
        render,
        customCompare,
        group,
        subgroup
      } = value;
      node.isCustomExpectation = true;
      if (parse) {
        parse(node);
      }
      node.customCompare = customCompare;
      node.render = props => render(node, props);
      node.group = group;
      node.subgroup = subgroup;
      return node;
    }
    if (category === "reference") {
      return node;
    }
    if (value === SOURCE_CODE_ENTRY_KEY || value === VALUE_OF_RETURN_VALUE_ENTRY_KEY || value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY) {
      node.category = "primitive";
      node.isString = true;
      return node;
    }
    if (group === "entries") {
      return node;
    }
    if (group === "entry") {
      return node;
    }
    // if (group === "part") {
    //   return node;
    // }
    if (subgroup === "array_entry_key" || subgroup === "arg_entry_key") {
      node.category = "primitive";
      node.isNumber = true;
      return node;
    }
    if (subgroup === "char_entry_value") {
      node.category = "primitive";
      node.isString = true;
      return node;
    }
    if (subgroup === "url_search_entry") {
      node.category = "composite";
      return node;
    }
    if (value === null) {
      node.category = "primitive";
      return node;
    }
    if (value === undefined) {
      node.category = "primitive";
      node.isUndefined = true;
      return node;
    }
    const typeofResult = typeof value;
    if (typeofResult === "number") {
      node.category = "primitive";
      node.isNumber = true;
      if (getIsNegativeZero(value)) {
        node.isNegativeZero = true;
      }
      // eslint-disable-next-line no-self-compare
      if (value !== value) {
        node.isNaN = true;
      }
      if (value === Infinity || value === -Infinity) {
        node.isInfinity = true;
      }
      node.childGenerator = () => {
        const numberCompositionNode = node.appendChild("composition", {
          value,
          render: renderChildren,
          onelineDiff: {},
          startMarker: node.startMarker,
          endMarker: node.endMarker,
          group: "entries",
          subgroup: "number_composition",
          childGenerator: () => {
            if (node.isNaN) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "NaN"
              });
              return;
            }
            if (node.isNegativeZero || Math.sign(value) === -1) {
              numberCompositionNode.appendChild("sign", {
                ...getGrammarProps(),
                group: "number_sign",
                value: "-"
              });
            }
            if (node.isNegativeZero) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "0"
              });
              return;
            }
            if (node.isInfinity) {
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: "Infinity"
              });
              return;
            }
            // integer
            if (value % 1 === 0) {
              const {
                integer
              } = tokenizeInteger(Math.abs(value));
              numberCompositionNode.appendChild("integer", {
                ...getGrammarProps(),
                group: "integer",
                value: numericSeparatorsDisabled ? integer : groupDigits(integer)
              });
              return;
            }
            // float
            const {
              integer,
              decimalSeparator,
              decimal
            } = tokenizeFloat(Math.abs(value));
            numberCompositionNode.appendChild("integer", {
              ...getGrammarProps(),
              group: "integer",
              value: numericSeparatorsDisabled ? integer : groupDigits(integer),
              separatorMarker: decimalSeparator
            });
            numberCompositionNode.appendChild("decimal", {
              ...getGrammarProps(),
              group: "decimal",
              value: numericSeparatorsDisabled ? decimal : groupDigits(decimal)
            });
          }
        });
      };
      return node;
    }
    if (typeofResult === "bigint") {
      node.category = "primitive";
      node.isBigInt = true;
      return node;
    }
    if (typeofResult === "string") {
      node.category = "primitive";
      node.isString = true;
      if (!quoteMarkerRef && !quotesDisabled) {
        node.quoteMarkerRef = quoteMarkerRef = {
          current: pickBestQuote(value, {
            quotesBacktickDisabled
          })
        };
      }
      if (!isStringForUrl && !urlStringDetectionDisabled && canParseUrl(value)) {
        node.isStringForUrl = isStringForUrl = true;
      }
      if (isStringForUrl) {
        node.childGenerator = () => {
          const urlObject = new URL(value);
          const urlPartsNode = node.appendChild("parts", {
            value,
            category: "url_parts",
            group: "entries",
            subgroup: "url_parts",
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: "…",
                between: "…",
                end: "…"
              }
            },
            startMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            endMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            quoteMarkerRef,
            childGenerator() {
              const {
                protocol,
                username,
                password,
                hostname,
                port,
                pathname,
                search,
                hash
              } = urlObject;
              const appendUrlPartNode = (name, value, params) => {
                urlPartsNode.appendChild(name, {
                  value,
                  render: renderValue,
                  urlStringDetectionDisabled: true,
                  preserveLineBreaks: true,
                  quoteMarkerRef,
                  quotesDisabled: true,
                  group: "url_part",
                  subgroup: "url_".concat(name),
                  ...params
                });
              };
              appendUrlPartNode("protocol", protocol, {
                endMarker: "//"
              });
              if (username) {
                appendUrlPartNode("username", decodeURIComponent(username), {
                  endMarker: password ? ":" : "@"
                });
                if (password) {
                  appendUrlPartNode("password", decodeURIComponent(password), {
                    endMarker: "@"
                  });
                }
              }
              appendUrlPartNode("hostname", decodeURIComponent(hostname));
              if (port) {
                appendUrlPartNode("port", parseInt(port), {
                  startMarker: ":",
                  numericSeparatorsDisabled: true
                });
              }
              if (pathname) {
                appendUrlPartNode("pathname", decodeURIComponent(pathname));
              }
              if (search) {
                const urlSearchNode = urlPartsNode.appendChild("search", {
                  value: null,
                  render: renderChildren,
                  startMarker: "?",
                  onelineDiff: {
                    hasTrailingSeparator: true
                  },
                  group: "entries",
                  subgroup: "url_search",
                  childGenerator() {
                    const searchParamsMap = tokenizeUrlSearch(search);
                    let searchEntryIndex = 0;
                    for (const [key, values] of searchParamsMap) {
                      const urlSearchEntryNode = urlSearchNode.appendChild(key, {
                        key: searchEntryIndex,
                        render: renderChildren,
                        onelineDiff: {
                          hasTrailingSeparator: true
                        },
                        path: node.path.append(key),
                        group: "entries",
                        subgroup: "url_search_entry",
                        childGenerator() {
                          let valueIndex = 0;
                          const isMultiValue = values.length > 1;
                          while (valueIndex < values.length) {
                            const urlSearchEntryPartNode = urlSearchEntryNode.appendChild(valueIndex, {
                              key,
                              render: renderChildren,
                              onelineDiff: {
                                hasTrailingSeparator: true
                              },
                              group: "entry",
                              subgroup: "url_search_value_entry",
                              path: isMultiValue ? urlSearchEntryNode.path.append(valueIndex, {
                                isIndexedEntry: true
                              }) : undefined
                            });
                            urlSearchEntryPartNode.appendChild("entry_key", {
                              value: key,
                              render: renderString,
                              stringDiffPrecision: "none",
                              startMarker: urlSearchEntryNode.key === 0 && valueIndex === 0 ? "" : "&",
                              separatorMarker: "=",
                              separatorMarkerWhenTruncated: "",
                              quoteMarkerRef,
                              quotesDisabled: true,
                              urlStringDetectionDisabled: true,
                              dateStringDetectionDisabled: true,
                              preserveLineBreaks: true,
                              group: "entry_key",
                              subgroup: "url_search_entry_key"
                            });
                            urlSearchEntryPartNode.appendChild("entry_value", {
                              value: values[valueIndex],
                              render: renderString,
                              stringDiffPrecision: "none",
                              quoteMarkerRef,
                              quotesDisabled: true,
                              urlStringDetectionDisabled: true,
                              dateStringDetectionDisabled: true,
                              preserveLineBreaks: true,
                              group: "entry_value",
                              subgroup: "url_search_entry_value"
                            });
                            valueIndex++;
                          }
                        }
                      });
                      searchEntryIndex++;
                    }
                  }
                });
              }
              if (hash) {
                appendUrlPartNode("hash", decodeURIComponent(hash));
              }
            }
          });
        };
        return node;
      }
      if (!isStringForDate && !dateStringDetectionDisabled && canParseDate(value)) {
        node.isStringForDate = isStringForDate = true;
      }
      if (isStringForDate) {
        node.childGenerator = () => {
          const localTimezoneOffset = new Date(0).getTimezoneOffset() * 60000;
          const dateString = value;
          const dateTimestamp = Date.parse(dateString);
          const dateObject = new Date(dateTimestamp + localTimezoneOffset);
          const datePartsNode = node.appendChild("parts", {
            value,
            category: "date_parts",
            group: "entries",
            subgroup: "date_parts",
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: "…",
                between: "…",
                end: "…"
              }
            },
            startMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            endMarker: quotesDisabled ? "" : quoteMarkerRef.current,
            quoteMarkerRef,
            childGenerator: () => {
              const appendDatePartNode = (name, value, params) => {
                datePartsNode.appendChild(name, {
                  value,
                  render: renderValue,
                  quoteMarkerRef,
                  quotesDisabled: true,
                  dateStringDetectionDisabled: true,
                  numericSeparatorsDisabled: true,
                  preserveLineBreaks: true,
                  group: "date_part",
                  subgroup: "date_".concat(name),
                  ...params
                });
              };
              appendDatePartNode("year", dateObject.getFullYear());
              appendDatePartNode("month", String(dateObject.getMonth() + 1).padStart(2, "0"), {
                startMarker: "-"
              });
              appendDatePartNode("day", String(dateObject.getDate()).padStart(2, "0"), {
                startMarker: "-"
              });
              const timePartsNode = datePartsNode.appendChild("time", {
                render: renderChildren,
                onelineDiff: {},
                group: "entries",
                subgroup: "date_time",
                isHiddenWhenSame: true,
                childGenerator: () => {
                  const appendTimePartNode = (name, value, params) => {
                    timePartsNode.appendChild(name, {
                      value,
                      render: renderString,
                      stringDiffPrecision: "none",
                      quoteMarkerRef,
                      quotesDisabled: true,
                      dateStringDetectionDisabled: true,
                      numericSeparatorsDisabled: true,
                      preserveLineBreaks: true,
                      group: "time_prop",
                      subgroup: "time_".concat(name),
                      ...params
                    });
                  };
                  appendTimePartNode("hours", String(dateObject.getHours()).padStart(2, "0"), {
                    startMarker: " "
                  });
                  appendTimePartNode("minutes", String(dateObject.getMinutes()).padStart(2, "0"), {
                    startMarker: ":"
                  });
                  appendTimePartNode("seconds", String(dateObject.getSeconds()).padStart(2, "0"), {
                    startMarker: ":"
                  });
                  appendTimePartNode("milliseconds", String(dateObject.getMilliseconds()).padStart(3, "0"), {
                    startMarker: ".",
                    endMarker: "Z",
                    isHiddenWhenSame: true
                  });
                }
              });
            }
          });
        };
        return node;
      }
      if (stringDiffPrecision === "per_line_and_per_char") {
        node.childGenerator = () => {
          const lineEntriesNode = node.appendChild("parts", {
            value,
            category: "line_parts",
            group: "entries",
            subgroup: "line_entries",
            render: renderChildrenMultiline,
            multilineDiff: {
              hasTrailingSeparator: true,
              skippedMarkers: {
                start: ["↑ 1 line ↑", "↑ {x} lines ↑"],
                between: ["↕ 1 line ↕", "↕ {x} lines ↕"],
                end: ["↓ 1 line ↓", "↓ {x} lines ↓"]
              },
              maxDiffType: "line",
              lineNumbersDisabled
            },
            startMarker: node.startMarker,
            endMarker: node.endMarker,
            quoteMarkerRef,
            childGenerator: () => {
              let isMultiline = false;
              const appendLineEntry = lineIndex => {
                const lineNode = lineEntriesNode.appendChild(lineIndex, {
                  value: "",
                  key: lineIndex,
                  render: renderChildren,
                  onelineDiff: {
                    focusedChildWhenSame: "first",
                    skippedMarkers: {
                      start: "…",
                      between: "…",
                      end: "…"
                    },
                    skippedMarkersPlacement: isMultiline ? "inside" : "outside",
                    childrenVisitMethod: "all_before_then_all_after"
                  },
                  // When multiline string appear as property value
                  // 1. It becomes hard to see if "," is part of the string or the separator
                  // 2. "," would appear twice if multiline string ends with ","
                  // {
                  //   foo: 1| line 1
                  //        2| line 2,,
                  //   bar: true,
                  // }
                  // Fortunately the line break already helps to split properties (foo and bar)
                  // so the following is readable
                  // {
                  //   foo: 1| line 1
                  //        2| line 2,
                  //   bar: true,
                  // }
                  // -> The separator is not present for multiline
                  group: "entries",
                  subgroup: "line_entry_value"
                });
                const appendCharNode = (charIndex, char) => {
                  lineNode.value += char; // just for debug purposes
                  lineNode.appendChild(charIndex, {
                    value: char,
                    render: renderChar,
                    renderOptions: isRegexpSource ? {
                      stringCharMapping: null
                    } : undefined,
                    quoteMarkerRef,
                    group: "entry_value",
                    subgroup: "char_entry_value"
                  });
                };
                return {
                  node: lineNode,
                  appendCharNode
                };
              };
              const chars = tokenizeString(value);
              let currentLineEntry = appendLineEntry(0);
              let lineIndex = 0;
              let charIndex = 0;
              for (const char of chars) {
                if (preserveLineBreaks || char !== "\n") {
                  currentLineEntry.appendCharNode(charIndex, char);
                  charIndex++;
                  continue;
                }
                isMultiline = true;
                lineIndex++;
                charIndex = 0;
                currentLineEntry = appendLineEntry(lineIndex);
              }
              if (isMultiline) {
                enableMultilineDiff(lineEntriesNode);
              } else {
                const firstLineNode = currentLineEntry.node;
                if (!quotesDisabled && quoteMarkerRef.current) {
                  firstLineNode.onelineDiff.hasMarkersWhenEmpty = true;
                  firstLineNode.startMarker = firstLineNode.endMarker = quoteMarkerRef.current;
                }
              }
            }
          });
        };
        return node;
      }
      if (!quotesDisabled) {
        node.startMarker = quoteMarkerRef.current;
        node.endMarker = quoteMarkerRef.current;
      }
      return node;
    }
    if (typeofResult === "symbol") {
      node.category = "primitive";
      node.isSymbol = true;
      node.childGenerator = () => {
        const wellKnownPath = getWellKnownValuePath(value);
        if (wellKnownPath) {
          const wellKnownNode = node.appendChild("well_known", {
            value: wellKnownPath,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true
            },
            category: "well_known",
            group: "entries",
            subgroup: "well_known",
            childGenerator() {
              let index = 0;
              for (const part of wellKnownPath) {
                wellKnownNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: part.value
                });
                index++;
              }
            }
          });
          return;
        }
        const symbolKey = Symbol.keyFor(value);
        if (symbolKey) {
          node.appendChild("symbol_construct", createMethodCallNode(node, {
            objectName: "Symbol",
            methodName: "for",
            args: [{
              value: symbolKey
            }]
          }));
          return;
        }
        const description = symbolToDescription(value);
        node.appendChild("symbol_construct", createMethodCallNode(node, {
          objectName: "Symbol",
          args: description ? [{
            value: symbolToDescription(value)
          }] : []
        }));
      };
      return node;
    }
    const isObject = typeofResult === "object";
    const isFunction = typeofResult === "function";
    if (isObject || isFunction) {
      node.category = "composite";
      node.referenceFromOthersSet = new Set();
      const reference = node.referenceMap.get(value);
      if (reference) {
        node.reference = reference;
        reference.referenceFromOthersSet.add(node);
      } else {
        node.referenceMap.set(value, node);
      }
      if (isFunction) {
        node.isFunction = true;
        node.functionAnalysis = tokenizeFunction(value);
      }
      for (const proto of objectPrototypeChainGenerator(value)) {
        const parentConstructor = proto.constructor;
        if (!parentConstructor) {
          continue;
        }
        if (parentConstructor.name === "Map") {
          node.isMap = true;
          continue;
        }
        if (parentConstructor.name === "Array") {
          node.isArray = true;
          continue;
        }
        if (parentConstructor.name === "Set") {
          node.isSet = true;
          continue;
        }
        if (parentConstructor.name === "URL") {
          node.isURL = true;
          continue;
        }
        if (parentConstructor.name === "URLSearchParams") {
          node.isURLSearchParams = true;
          continue;
        }
        if (parentConstructor.name === "Headers") {
          node.isHeaders = true;
          continue;
        }
        if (parentConstructor.name === "Date") {
          node.isDate = true;
          continue;
        }
        if (parentConstructor.name === "RegExp") {
          node.isRegExp = true;
          continue;
        }
        if (parentConstructor.name === "Promise") {
          node.isPromise = true;
          continue;
        }
        if (parentConstructor.name === "Request") {
          node.isRequest = true;
          continue;
        }
        if (parentConstructor.name === "Response") {
          node.isResponse = true;
          continue;
        }
        if (parentConstructor.name === "AbortController") {
          node.isAbortController = true;
          continue;
        }
        if (parentConstructor.name === "AbortSignal") {
          node.isAbortSignal = true;
          continue;
        }
        if (parentConstructor.name === "String") {
          node.isStringObject = true;
          continue;
        }
        if (
        // "Int8Array",
        // "Uint8Array",
        // "Uint8ClampedArray",
        // "Int16Array",
        // "Uint16Array",
        // "Int32Array",
        // "Uint32Array",
        // "Float32Array",
        // "Float64Array",
        // "BigInt64Array",
        // "BigUint64Array",
        parentConstructor.name === "TypedArray") {
          node.isTypedArray = true;
          continue;
        }
        if (parentConstructor.name === "Error") {
          node.isError = true;
          continue;
        }
      }
      let isFrozen = false;
      let isSealed = false;
      let isExtensible = true;
      if (Object.isFrozen(value)) {
        isFrozen = true;
      } else if (Object.isSealed(value)) {
        isSealed = true;
      } else if (!Object.isExtensible(value)) {
        isExtensible = false;
      }
      const wellKnownPath = getWellKnownValuePath(value);
      if (node.reference || wellKnownPath || node.isFunction || isFunctionPrototype) ; else {
        node.objectTag = getObjectTag(value);
      }
      node.childGenerator = function () {
        if (node.reference) {
          const referenceNode = node.appendChild("reference", {
            value: node.reference.path,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true
            },
            category: "reference",
            group: "entries",
            subgroup: "reference",
            childGenerator() {
              let index = 0;
              for (const path of node.reference.path) {
                referenceNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: path.value
                });
                index++;
              }
            }
          });
          return;
        }
        if (wellKnownPath) {
          const wellKnownNode = node.appendChild("well_known", {
            value: wellKnownPath,
            render: renderChildren,
            onelineDiff: {
              hasTrailingSeparator: true
            },
            category: "well_known",
            group: "entries",
            subgroup: "well_known",
            childGenerator() {
              let index = 0;
              for (const part of wellKnownPath) {
                wellKnownNode.appendChild(index, {
                  ...getGrammarProps(),
                  group: "path",
                  value: part.value
                });
                index++;
              }
            }
          });
          return;
        }
        const compositePartsNode = node.appendChild("parts", {
          category: "composite_parts",
          render: renderChildren,
          onelineDiff: {
            hasSpacingBetweenEachChild: true,
            hasTrailingSeparator: true
          },
          childGenerator: () => {
            const ownPropertyNameToIgnoreSet = new Set();
            const ownPropertSymbolToIgnoreSet = new Set();
            const propertyLikeCallbackSet = new Set();
            const propertyConverterMap = new Map();
            const objectIntegrityMethodName = isFrozen ? "freeze" : isSealed ? "seal" : isExtensible ? "" : "preventExtensions";
            if (objectIntegrityMethodName) {
              const objectIntegrityNode = compositePartsNode.appendChild("object_integrity", {
                value: null,
                render: renderChildren,
                onelineDiff: {
                  hasTrailingSeparator: true
                },
                hasRightSpacingDisabled: true,
                group: "entries",
                subgroup: "object_integrity",
                childGenerator: () => {
                  objectIntegrityNode.appendChild("object_name", {
                    ...getGrammarProps(),
                    value: "Object",
                    separatorMarker: "."
                  });
                  objectIntegrityNode.appendChild("method_name", {
                    ...getGrammarProps(),
                    value: objectIntegrityMethodName,
                    separatorMarker: "("
                  });
                }
              });
            }
            let objectConstructNode = null;
            let objectConstructArgs = null;
            construct: {
              if (node.isFunction) {
                ownPropertyNameToIgnoreSet.add("length");
                ownPropertyNameToIgnoreSet.add("name");
                const functionConstructNode = compositePartsNode.appendChild("construct", {
                  value: null,
                  render: renderChildren,
                  onelineDiff: {
                    hasSpacingBetweenEachChild: true
                  },
                  group: "entries",
                  subgroup: "function_construct",
                  childGenerator() {
                    if (node.functionAnalysis.type === "class") {
                      functionConstructNode.appendChild("class_keyword", {
                        ...getGrammarProps(),
                        group: "class_keyword",
                        value: "class"
                      });
                      if (node.functionAnalysis.name) {
                        functionConstructNode.appendChild("function_name", {
                          ...getGrammarProps(),
                          group: "function_name",
                          value: node.functionAnalysis.name
                        });
                      }
                      const extendedClassName = node.functionAnalysis.extendedClassName;
                      if (extendedClassName) {
                        functionConstructNode.appendChild("class_extends_keyword", {
                          ...getGrammarProps(),
                          group: "class_extends_keyword",
                          value: "extends"
                        });
                        functionConstructNode.appendChild("class_extended_name", {
                          ...getGrammarProps(),
                          group: "class_extended_name",
                          value: extendedClassName
                        });
                      }
                      return;
                    }
                    if (node.functionAnalysis.isAsync) {
                      functionConstructNode.appendChild("function_async_keyword", {
                        ...getGrammarProps(),
                        group: "function_async_keyword",
                        value: "async"
                      });
                    }
                    if (node.functionAnalysis.type === "classic") {
                      functionConstructNode.appendChild("function_keyword", {
                        ...getGrammarProps(),
                        group: "function_keyword",
                        value: node.functionAnalysis.isGenerator ? "function*" : "function"
                      });
                    }
                    if (node.functionAnalysis.name) {
                      functionConstructNode.appendChild("function_name", {
                        ...getGrammarProps(),
                        group: "function_name",
                        value: node.functionAnalysis.name
                      });
                    }
                    {
                      const appendFunctionBodyPrefix = prefix => {
                        functionConstructNode.appendChild("function_body_prefix", {
                          ...getGrammarProps(),
                          group: "function_body_prefix",
                          value: prefix
                        });
                      };
                      if (node.functionAnalysis.type === "arrow") {
                        appendFunctionBodyPrefix("() =>");
                      } else if (node.functionAnalysis.type === "method") {
                        let methodName;
                        if (node.subgroup === "property_descriptor_value") {
                          methodName = node.parent.parent.key;
                        } else {
                          methodName = key;
                        }
                        if (node.functionAnalysis.getterName) {
                          appendFunctionBodyPrefix("get ".concat(methodName, "()"));
                        } else if (node.functionAnalysis.setterName) {
                          appendFunctionBodyPrefix("set ".concat(methodName, "()"));
                        } else {
                          appendFunctionBodyPrefix("".concat(methodName, "()"));
                        }
                      } else if (node.functionAnalysis.type === "classic") {
                        appendFunctionBodyPrefix("()");
                      }
                    }
                  }
                });
                break construct;
              }
              if (isFunctionPrototype) {
                break construct;
              }
              if (node.isError) {
                ownPropertyNameToIgnoreSet.add("stack");
                const messageOwnPropertyDescriptor = Object.getOwnPropertyDescriptor(value, "message");
                if (messageOwnPropertyDescriptor) {
                  ownPropertyNameToIgnoreSet.add("message");
                }
                const errorConstructNode = compositePartsNode.appendChild("construct", {
                  value: null,
                  render: renderChildren,
                  onelineDiff: {},
                  group: "entries",
                  subgroup: "error_construct",
                  childGenerator: () => {
                    errorConstructNode.appendChild("error_constructor", {
                      ...getGrammarProps(),
                      value: node.objectTag,
                      separatorMarker: ": "
                    });
                    if (messageOwnPropertyDescriptor) {
                      const errorMessage = messageOwnPropertyDescriptor.value;
                      errorConstructNode.appendChild("error_message", {
                        render: renderString,
                        group: "error_message",
                        value: errorMessage,
                        lineNumbersDisabled: true,
                        quotesDisabled: true
                      });
                    }
                  }
                });
                break construct;
              }
              if (node.isRegExp) {
                let regexpSource = value.source;
                if (regexpSource === "(?:)") {
                  regexpSource = "";
                }
                regexpSource = "/".concat(regexpSource, "/").concat(value.flags);
                compositePartsNode.appendChild("construct", {
                  value: regexpSource,
                  render: renderValue,
                  isRegexpSource: true,
                  quotesDisabled: true,
                  group: "regexp_source",
                  subgroup: "regexp_source"
                });
                break construct;
              }
              if (node.objectTag && node.objectTag !== "Object" && node.objectTag !== "Array") {
                objectConstructNode = compositePartsNode.appendChild("construct", {
                  group: "entries",
                  subgroup: "object_construct",
                  value: null,
                  render: renderChildren,
                  onelineDiff: {
                    hasSpacingBetweenEachChild: true
                  },
                  childGenerator() {
                    if (objectConstructArgs) {
                      objectConstructNode.appendChild("call", createMethodCallNode(objectConstructNode, {
                        objectName: node.objectTag,
                        args: objectConstructArgs
                      }));
                    } else {
                      objectConstructNode.appendChild("object_tag", {
                        ...getGrammarProps(),
                        group: "object_tag",
                        path: node.path.append("[[ObjectTag]]"),
                        value: node.objectTag
                      });
                    }
                  }
                });
                break construct;
              }
            }
            wrapped_value: {
              // toString()
              if (node.isURL) {
                objectConstructArgs = [{
                  value: value.href,
                  key: "toString()",
                  isStringForUrl: true
                }];
                break wrapped_value;
              }
              if (node.isDate) {
                objectConstructArgs = [{
                  value: value.toString(),
                  key: "toString()",
                  isStringForDate: true
                }];
                break wrapped_value;
              }
              if (node.isRequest) {
                const requestDefaultValues = {
                  body: null,
                  bodyUsed: false,
                  cache: "default",
                  credentials: "same-origin",
                  destination: "",
                  headers: undefined,
                  method: "GET",
                  mode: "cors",
                  priority: undefined,
                  redirect: "follow",
                  referrerPolicy: "",
                  referrer: "about:client",
                  signal: null
                };
                const requestInitOptions = {};
                let hasCustomInit = false;
                for (const requestInternalPropertyName of Object.keys(requestDefaultValues)) {
                  const requestInternalPropertyValue = value[requestInternalPropertyName];
                  if (requestInternalPropertyName === "headers") {
                    let headersAreEmpty = true;
                    // eslint-disable-next-line no-unused-vars
                    for (const entry of requestInternalPropertyValue) {
                      headersAreEmpty = false;
                      break;
                    }
                    if (headersAreEmpty) {
                      continue;
                    }
                  } else if (requestInternalPropertyName === "signal") {
                    if (!requestInternalPropertyValue.aborted) {
                      continue;
                    }
                  } else {
                    const requestInternalPropertyDefaultValue = requestDefaultValues[requestInternalPropertyName];
                    if (requestInternalPropertyValue === requestInternalPropertyDefaultValue) {
                      continue;
                    }
                  }
                  hasCustomInit = true;
                  requestInitOptions[requestInternalPropertyName] = requestInternalPropertyValue;
                }
                objectConstructArgs = [{
                  value: value.url,
                  key: "url"
                }, ...(hasCustomInit ? [{
                  value: requestInitOptions
                }] : [])];
                break wrapped_value;
              }
              if (node.isResponse) {
                const responseInitOptions = {};
                const bodyUsed = value.bodyUsed;
                if (bodyUsed) {
                  responseInitOptions.bodyUsed = true;
                }
                const headers = value.headers;
                let headersAreEmpty = true;
                // eslint-disable-next-line no-unused-vars
                for (const entry of headers) {
                  headersAreEmpty = false;
                  break;
                }
                if (!headersAreEmpty) {
                  responseInitOptions.headers = headers;
                }
                const status = value.status;
                responseInitOptions.status = status;
                const statusText = value.statusText;
                if (statusText !== "") {
                  responseInitOptions.statusText = statusText;
                }
                const url = value.url;
                if (url) {
                  responseInitOptions.url = url;
                }
                const type = value.type;
                if (type !== "default") {
                  responseInitOptions.type = type;
                }
                const redirected = value.redirected;
                if (redirected) {
                  responseInitOptions.redirected = redirected;
                }
                objectConstructArgs = [{
                  value: value.body,
                  key: "body",
                  isBody: true
                }, ...(Object.keys(responseInitOptions).length ? [{
                  value: responseInitOptions
                }] : [])];
                break wrapped_value;
              }
              // valueOf()
              const valueOf = value.valueOf;
              if (typeof valueOf === "function" && valueOf !== Object.prototype.valueOf) {
                if (objectConstructNode) {
                  ownPropertyNameToIgnoreSet.add("valueOf");
                  objectConstructArgs = [{
                    value: valueOf.call(value),
                    key: "valueOf()"
                  }];
                  break wrapped_value;
                }
                if (Object.hasOwn(value, "valueOf")) {
                  propertyConverterMap.set("valueOf", () => {
                    return [VALUE_OF_RETURN_VALUE_ENTRY_KEY, valueOf.call(value)];
                  });
                } else {
                  propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                    appendPropertyEntryNode(VALUE_OF_RETURN_VALUE_ENTRY_KEY, valueOf.call(value));
                  });
                }
                break wrapped_value;
              }
            }
            symbol_to_primitive: {
              const toPrimitive = value[Symbol.toPrimitive];
              if (typeof toPrimitive !== "function") {
                break symbol_to_primitive;
              }
              if (node.isDate && toPrimitive === Date.prototype[Symbol.toPrimitive]) {
                break symbol_to_primitive;
              }
              if (objectConstructNode && !objectConstructArgs) {
                ownPropertSymbolToIgnoreSet.add(Symbol.toPrimitive);
                objectConstructArgs = [{
                  value: toPrimitive.call(value, "string"),
                  key: "toPrimitive()"
                }];
              } else if (Object.hasOwn(value, Symbol.toPrimitive)) {
                propertyConverterMap.set(Symbol.toPrimitive, () => {
                  return [SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY, toPrimitive.call(value, "string")];
                });
              } else {
                propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                  appendPropertyEntryNode(SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY, toPrimitive.call(value, "string"));
                });
              }
            }
            internal_entries: {
              const internalEntriesParams = {
                render: renderChildrenMultilineWhenDiff,
                startMarker: "(",
                endMarker: ")",
                onelineDiff: {
                  hasMarkersWhenEmpty: true,
                  hasSpacingBetweenEachChild: true
                },
                multilineDiff: {
                  hasMarkersWhenEmpty: true,
                  hasTrailingSeparator: true,
                  hasNewLineAroundChildren: true,
                  hasIndentBeforeEachChild: true,
                  skippedMarkers: {
                    start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                    between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                    end: ["↓ 1 value ↓", "↓ {x} values ↓"]
                  },
                  maxDiffType: "prop"
                },
                hasLeftSpacingDisabled: true,
                group: "entries"
              };
              if (node.isMap) {
                const mapEntriesNode = compositePartsNode.appendChild("internal_entries", {
                  ...internalEntriesParams,
                  subgroup: "map_entries",
                  childGenerator: () => {
                    const objectTagCounterMap = new Map();
                    for (const [mapEntryKey, mapEntryValue] of value) {
                      let pathPart;
                      if (isComposite(mapEntryKey)) {
                        const keyObjectTag = getObjectTag(mapEntryKey);
                        if (objectTagCounterMap.has(keyObjectTag)) {
                          const objectTagCount = objectTagCounterMap.get(keyObjectTag) + 1;
                          objectTagCounterMap.set(keyObjectTag, objectTagCount);
                          pathPart = "".concat(keyObjectTag, "#").concat(objectTagCount);
                        } else {
                          objectTagCounterMap.set(keyObjectTag, 1);
                          pathPart = "".concat(keyObjectTag, "#1");
                        }
                      } else {
                        pathPart = String(mapEntryKey);
                      }
                      const mapEntryNode = mapEntriesNode.appendChild(mapEntryKey, {
                        key: mapEntryKey,
                        render: renderChildren,
                        onelineDiff: {
                          hasTrailingSeparator: true
                        },
                        group: "entry",
                        subgroup: "map_entry",
                        path: node.path.append(pathPart)
                      });
                      mapEntryNode.appendChild("entry_key", {
                        value: mapEntryKey,
                        render: renderValue,
                        separatorMarker: " => ",
                        group: "entry_key",
                        subgroup: "map_entry_key"
                      });
                      mapEntryNode.appendChild("entry_value", {
                        value: mapEntryValue,
                        render: renderValue,
                        separatorMarker: ",",
                        group: "entry_value",
                        subgroup: "map_entry_value"
                      });
                    }
                    objectTagCounterMap.clear();
                  }
                });
                break internal_entries;
              }
              if (node.isSet) {
                const setEntriesNode = compositePartsNode.appendChild("internal_entries", {
                  ...internalEntriesParams,
                  subgroup: "set_entries",
                  childGenerator: () => {
                    let index = 0;
                    for (const [setValue] of value) {
                      setEntriesNode.appendChild(index, {
                        value: setValue,
                        render: renderValue,
                        separatorMarker: ",",
                        group: "entry_value",
                        subgroup: "set_entry",
                        path: setEntriesNode.path.append(index, {
                          isIndexedEntry: true
                        })
                      });
                      index++;
                    }
                  }
                });
                break internal_entries;
              }
              if (node.isURLSearchParams) {
                const searchParamsMap = new Map();
                for (let [urlSearchParamKey, urlSearchParamValue] of value) {
                  const existingUrlSearchParamValue = searchParamsMap.get(urlSearchParamKey);
                  if (existingUrlSearchParamValue) {
                    urlSearchParamValue = [...existingUrlSearchParamValue, urlSearchParamValue];
                  } else {
                    urlSearchParamValue = [urlSearchParamValue];
                  }
                  searchParamsMap.set(urlSearchParamKey, urlSearchParamValue);
                }
                const urlSearchParamEntries = compositePartsNode.appendChild("internal_entries", {
                  ...internalEntriesParams,
                  subgroup: "url_search_params_entries",
                  childGenerator: () => {
                    for (const [key, values] of searchParamsMap) {
                      const urlSearchParamEntryNode = urlSearchParamEntries.appendChild(key, {
                        key,
                        render: renderChildren,
                        onelineDiff: {
                          hasTrailingSeparator: true
                        },
                        group: "entry",
                        subgroup: "url_search_param_entry",
                        path: node.path.append(key)
                      });
                      urlSearchParamEntryNode.appendChild("entry_key", {
                        value: key,
                        render: renderValue,
                        separatorMarker: " => ",
                        group: "entry_key",
                        subgroup: "url_search_param_entry_key"
                      });
                      urlSearchParamEntryNode.appendChild("entry_value", {
                        value: values,
                        render: renderValue,
                        separatorMarker: ",",
                        group: "entry_value",
                        subgroup: "url_search_param_entry_value"
                      });
                    }
                  }
                });
                break internal_entries;
              }
              if (node.isHeaders) {
                const headerEntriesNode = compositePartsNode.appendChild("header_entries", {
                  ...internalEntriesParams,
                  subgroup: "header_entries",
                  childGenerator: () => {
                    for (const [headerName, headerValueRaw] of value) {
                      const headerNode = headerEntriesNode.appendChild(key, {
                        key: headerName,
                        render: renderChildren,
                        onelineDiff: {
                          hasTrailingSeparator: true
                        },
                        group: "entry",
                        subgroup: "header_entry",
                        path: node.path.append(headerName)
                      });
                      headerNode.appendChild("entry_key", {
                        value: headerName,
                        render: renderString,
                        separatorMarker: " => ",
                        group: "entry_key",
                        subgroup: "header_entry_key"
                      });
                      const quoteMarkerRef = {
                        current: pickBestQuote(headerValueRaw)
                      };
                      if (["access-control-max-age", "age", "content-length"].includes(headerName)) {
                        headerNode.appendChild("entry_value", {
                          group: "entry_value",
                          subgroup: "header_entry_value",
                          value: isNaN(headerValueRaw) ? headerValueRaw : parseInt(headerValueRaw),
                          render: renderValue,
                          startMarker: "\"",
                          endMarker: '"',
                          numericSeparatorsDisabled: true
                        });
                        return;
                      }
                      let attributeHandlers = null;
                      if (headerName === "set-cookie") {
                        attributeHandlers = {};
                      } else if (headerName === "accept" || headerName === "accept-encoding" || headerName === "accept-language") {
                        attributeHandlers = {
                          q: attributeValue => {
                            return isNaN(attributeValue) ? attributeValue : parseFloat(attributeValue);
                          }
                        };
                      } else if (headerName === "server-timing") {
                        attributeHandlers = {
                          dur: attributeValue => {
                            return isNaN(attributeValue) ? attributeValue : parseFloat(attributeValue);
                          }
                        };
                      }
                      if (attributeHandlers) {
                        const headerValueNode = headerNode.appendChild("entry_value", {
                          category: "header_value_parts",
                          group: "entries",
                          subgroup: "header_value",
                          value: headerValueRaw,
                          render: renderChildren,
                          onelineDiff: {
                            skippedMarkers: {
                              start: "…",
                              between: "…",
                              end: "…"
                            }
                          },
                          startMarker: quoteMarkerRef.current,
                          endMarker: quoteMarkerRef.current,
                          childGenerator: () => {
                            generateHeaderValueParts(headerValueRaw, {
                              headerValueNode,
                              quoteMarkerRef
                            });
                          }
                        });
                        return;
                      }
                      const headerValueArray = headerValueRaw.split(",");
                      const headerValueNode = headerNode.appendChild("entry_value", {
                        value: headerValueArray,
                        render: renderChildren,
                        onelineDiff: {
                          skippedMarkers: {
                            start: "…",
                            between: "…",
                            end: "…"
                          }
                        },
                        startMarker: quoteMarkerRef.current,
                        endMarker: quoteMarkerRef.current,
                        separatorMarker: ",",
                        childGenerator: () => {
                          let index = 0;
                          for (const headerValue of headerValueArray) {
                            headerValueNode.appendChild(index, {
                              value: headerValue,
                              render: renderString,
                              stringDiffPrecision: "none",
                              quoteMarkerRef,
                              quotesDisabled: true,
                              preserveLineBreaks: true,
                              separatorMarker: ",",
                              group: "part",
                              subgroup: "header_value_part"
                            });
                            index++;
                          }
                        },
                        group: "entries",
                        subgroup: "header_value_entries"
                      });
                    }
                  }
                });
                break internal_entries;
              }
            }
            indexed_entries: {
              if (node.isArray) {
                ownPropertyNameToIgnoreSet.add("length");
                const arrayEntriesNode = compositePartsNode.appendChild("indexed_entries", {
                  render: renderChildrenMultilineWhenDiff,
                  startMarker: "[",
                  endMarker: "]",
                  onelineDiff: {
                    hasMarkersWhenEmpty: true,
                    hasSpacingBetweenEachChild: true,
                    skippedMarkers: {
                      start: "…",
                      between: "…",
                      end: "…"
                    }
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty: true,
                    hasTrailingSeparator: true,
                    hasNewLineAroundChildren: true,
                    hasIndentBeforeEachChild: true,
                    skippedMarkers: {
                      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                      between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                      end: ["↓ 1 value ↓", "↓ {x} values ↓"]
                    },
                    maxDiffType: "prop"
                  },
                  group: "entries",
                  subgroup: "array_entries"
                });
                const arrayChildrenGenerator = () => {
                  let index = 0;
                  while (index < value.length) {
                    ownPropertyNameToIgnoreSet.add(String(index));
                    const hasOwnIndex = Object.hasOwn(value, index);
                    arrayEntriesNode.appendChild(index, {
                      value: hasOwnIndex ? value[index] : ARRAY_EMPTY_VALUE,
                      render: hasOwnIndex ? renderValue : renderEmptyValue,
                      separatorMarker: ",",
                      group: "entry_value",
                      subgroup: "array_entry_value",
                      path: arrayEntriesNode.path.append(index, {
                        isIndexedEntry: true
                      })
                    });
                    index++;
                  }
                };
                arrayChildrenGenerator();
                break indexed_entries;
              }
              if (node.isTypedArray) {
                ownPropertyNameToIgnoreSet.add("length");
                const typedEntriesNode = compositePartsNode.appendChild("indexed_entries", {
                  render: renderChildrenMultilineWhenDiff,
                  startMarker: "[",
                  endMarker: "]",
                  onelineDiff: {
                    hasMarkersWhenEmpty: true,
                    hasSpacingBetweenEachChild: true,
                    skippedMarkers: {
                      start: "…",
                      between: "…",
                      end: "…"
                    }
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty: true,
                    hasTrailingSeparator: true,
                    hasNewLineAroundChildren: true,
                    hasIndentBeforeEachChild: true,
                    skippedMarkers: {
                      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
                      between: ["↕ 1 value ↕", "↕ {x} values ↕"],
                      end: ["↓ 1 value ↓", "↓ {x} values ↓"]
                    },
                    maxDiffType: "prop"
                  },
                  group: "entries",
                  subgroup: "typed_array_entries"
                });
                const typedArrayChildrenGenerator = () => {
                  let index = 0;
                  while (index < value.length) {
                    ownPropertyNameToIgnoreSet.add(String(index));
                    typedEntriesNode.appendChild(index, {
                      value: value[index],
                      render: renderNumber,
                      separatorMarker: ",",
                      group: "entry_value",
                      subgroup: "typed_array_entry_value",
                      path: typedEntriesNode.path.append(index, {
                        isIndexedEntry: true
                      })
                    });
                    index++;
                  }
                };
                typedArrayChildrenGenerator();
                break indexed_entries;
              }
              if (node.isStringObject) {
                ownPropertyNameToIgnoreSet.add("length");
                let index = 0;
                while (index < value.length) {
                  ownPropertyNameToIgnoreSet.add(String(index));
                  index++;
                }
                break indexed_entries;
              }
            }
            prototype: {
              if (node.objectTag !== "Object") {
                // - [] means Array.prototype
                // - Map("a" => true) means Map.prototype
                // - User {} means User.prototype (each application will "known" what "User" refers to)
                //   This means if 2 proto got the same name
                //   assert will consider they are equal even if that might not be the case
                //   It's a known limitation that could be addressed later
                //   as it's unlikely to happen or be important
                break prototype;
              }
              if (node.isFunction) {
                // prototype can be infered by construct notation
                // -> no need to display it
                // actual: () => {}
                // expect: function () {}
                break prototype;
              }
              if (node.isFunction && node.functionAnalysis.extendedClassName) {
                // prototype property can be infered thanks to the usage of extends
                break prototype;
              }
              const protoValue = Object.getPrototypeOf(value);
              if (protoValue === undefined) {
                break prototype;
              }
              if (protoValue === Object.prototype) {
                // - {} means Object.prototype
                break prototype;
              }
              propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                appendPropertyEntryNode("__proto__", protoValue);
              });
            }
            own_properties: {
              const allOwnPropertySymbols = Object.getOwnPropertySymbols(value);
              const allOwnPropertyNames = Object.getOwnPropertyNames(value);
              const ownPropertySymbols = [];
              const ownPropertyNames = [];
              for (const ownPropertySymbol of allOwnPropertySymbols) {
                if (ownPropertSymbolToIgnoreSet.has(ownPropertySymbol)) {
                  continue;
                }
                if (shouldIgnoreOwnPropertySymbol(node, ownPropertySymbol)) {
                  continue;
                }
                ownPropertySymbols.push(ownPropertySymbol);
              }
              for (const ownPropertyName of allOwnPropertyNames) {
                if (ownPropertyNameToIgnoreSet.has(ownPropertyName)) {
                  continue;
                }
                if (shouldIgnoreOwnPropertyName(node, ownPropertyName)) {
                  continue;
                }
                ownPropertyNames.push(ownPropertyName);
              }
              if (node.isAbortSignal) {
                const aborted = value.aborted;
                if (aborted) {
                  propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                    appendPropertyEntryNode("aborted", true);
                  });
                  const reason = value.reason;
                  if (reason !== undefined) {
                    propertyLikeCallbackSet.add(appendPropertyEntryNode => {
                      appendPropertyEntryNode("reason", reason);
                    });
                  }
                }
              }
              // the idea here is that when an object does not have any property
              // we skip entirely the creation of own_properties node so that
              // if that value is compared to an object
              // {} is not even displayed even if empty
              // as a result an array without own property would be displayed as follow:
              // "[]"
              // and not
              // "[] {}"
              // the goal is to enable this for every well known object tag
              // one of the easiest way to achieve this would be to added something like
              // hasWellKnownPrototype: boolean
              // -> to be added when comparing prototypes
              const canSkipOwnProperties = node.isArray || node.isTypedArray || node.isMap || node.isSet || node.isURL || node.isURLSearchParams || node.isRequest || node.isResponse || node.isAbortController || node.isAbortSignal || node.isError || node.isRegExp;
              const skipOwnProperties = canSkipOwnProperties && ownPropertySymbols.length === 0 && ownPropertyNames.length === 0 && propertyLikeCallbackSet.size === 0;
              if (skipOwnProperties) {
                break own_properties;
              }
              const hasMarkersWhenEmpty = !objectConstructNode && !canSkipOwnProperties;
              const ownPropertiesNode = compositePartsNode.appendChild("own_properties", {
                render: renderChildrenMultilineWhenDiff,
                group: "entries",
                subgroup: "own_properties",
                ...(node.isClassPrototype ? {
                  onelineDiff: {
                    hasMarkersWhenEmpty,
                    separatorBetweenEachChildDisabled: true
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty,
                    separatorBetweenEachChildDisabled: true
                  }
                } : {
                  startMarker: "{",
                  endMarker: "}",
                  onelineDiff: {
                    hasMarkersWhenEmpty,
                    hasSpacingAroundChildren: true,
                    hasSpacingBetweenEachChild: true
                  },
                  multilineDiff: {
                    hasMarkersWhenEmpty,
                    hasTrailingSeparator: true,
                    hasNewLineAroundChildren: true,
                    hasIndentBeforeEachChild: true,
                    skippedMarkers: {
                      start: ["↑ 1 prop ↑", "↑ {x} props ↑"],
                      between: ["↕ 1 prop ↕", "↕ {x} props ↕"],
                      end: ["↓ 1 prop ↓", "↓ {x} props ↓"]
                    },
                    maxDiffType: "prop"
                  }
                }),
                childGenerator: () => {
                  const appendPropertyNode = (propertyKey, propertyDescriptor, {
                    isSourceCode,
                    isFunctionPrototype,
                    isClassPrototype,
                    isHiddenWhenSame,
                    isHiddenWhenSolo,
                    isBody
                  }) => {
                    const propertyConverter = propertyConverterMap.get(propertyKey);
                    if (propertyConverter) {
                      const converterResult = propertyConverter();
                      propertyKey = converterResult[0];
                      propertyDescriptor = {
                        value: converterResult[1]
                      };
                    }
                    const ownPropertyNode = ownPropertiesNode.appendChild(propertyKey, {
                      key: propertyKey,
                      render: renderChildrenMultilineWhenDiff,
                      multilineDiff: {
                        hasIndentBetweenEachChild: true
                      },
                      onelineDiff: {
                        hasTrailingSeparator: true,
                        hasSpacingBetweenEachChild: true
                      },
                      focusedChildIndex: 0,
                      isFunctionPrototype,
                      isClassPrototype,
                      isHiddenWhenSame,
                      isHiddenWhenSolo,
                      childGenerator: () => {
                        let isMethod = false;
                        if (propertyDescriptor.value) {
                          isMethod = typeof propertyDescriptor.value === "function" && tokenizeFunction(propertyDescriptor.value).type === "method";
                        }
                        for (const descriptorName of Object.keys(propertyDescriptor)) {
                          const descriptorValue = propertyDescriptor[descriptorName];
                          if (shouldIgnoreOwnPropertyDescriptor(node, descriptorName, descriptorValue, {
                            isFrozen,
                            isSealed,
                            propertyKey
                          })) {
                            continue;
                          }
                          const descriptorNode = ownPropertyNode.appendChild(descriptorName, {
                            render: renderChildren,
                            onelineDiff: {
                              hasTrailingSeparator: true
                            },
                            focusedChildIndex: 0,
                            group: "entries",
                            subgroup: "property_descriptor",
                            isHiddenWhenSame: descriptorName === "configurable" || descriptorName === "writable" || descriptorName === "enumerable"
                          });
                          if (descriptorName === "configurable" || descriptorName === "writable" || descriptorName === "enumerable") {
                            descriptorNode.appendChild("descriptor_name", {
                              ...getGrammarProps(),
                              group: "property_descriptor_name",
                              value: descriptorName,
                              separatorMarker: " "
                            });
                          }
                          if (node.functionAnalysis.type === "class" && !isClassPrototype) {
                            descriptorNode.appendChild("static_keyword", {
                              ...getGrammarProps(),
                              group: "static_keyword",
                              value: "static",
                              separatorMarker: " ",
                              isHidden: isSourceCode || isMethod
                            });
                          }
                          if (descriptorName !== "get" && descriptorName !== "set") {
                            descriptorNode.appendChild("entry_key", {
                              value: propertyKey,
                              render: renderPrimitive,
                              quotesDisabled: typeof propertyKey === "string" && isValidPropertyIdentifier(propertyKey),
                              quotesBacktickDisabled: true,
                              separatorMarker: node.isClassPrototype ? "" : node.functionAnalysis.type === "class" ? " = " : ": ",
                              separatorMarkerWhenTruncated: node.isClassPrototype ? "" : node.functionAnalysis.type === "class" ? ";" : ",",
                              group: "entry_key",
                              subgroup: "property_key",
                              isHidden: isSourceCode || isMethod || isClassPrototype
                            });
                          }
                          descriptorNode.appendChild("entry_value", {
                            key: descriptorName,
                            value: descriptorValue,
                            render: renderValue,
                            separatorMarker: node.functionAnalysis.type === "class" ? ";" : ",",
                            group: "entry_value",
                            subgroup: "property_descriptor_value",
                            isSourceCode,
                            isBody,
                            isFunctionPrototype,
                            isClassPrototype
                          });
                        }
                      },
                      group: "entry",
                      subgroup: "property_entry",
                      path: node.path.append(propertyKey)
                    });
                    return ownPropertyNode;
                  };
                  const appendPropertyNodeSimplified = (propertyKey, propertyValue, params = {}) => {
                    return appendPropertyNode(propertyKey, {
                      // enumerable: true,
                      // /* eslint-disable no-unneeded-ternary */
                      // configurable: isFrozen || isSealed ? false : true,
                      // writable: isFrozen ? false : true,
                      // /* eslint-enable no-unneeded-ternary */
                      value: propertyValue
                    }, params);
                  };
                  if (node.isFunction) {
                    appendPropertyNodeSimplified(SOURCE_CODE_ENTRY_KEY, node.functionAnalysis.argsAndBodySource, {
                      isSourceCode: true
                    });
                  }
                  for (const propertyLikeCallback of propertyLikeCallbackSet) {
                    propertyLikeCallback(appendPropertyNodeSimplified);
                  }
                  for (const ownPropertySymbol of ownPropertySymbols) {
                    const ownPropertySymbolDescriptor = Object.getOwnPropertyDescriptor(value, ownPropertySymbol);
                    appendPropertyNode(ownPropertySymbol, ownPropertySymbolDescriptor, {
                      isHiddenWhenSame: true
                    });
                  }
                  for (let ownPropertyName of ownPropertyNames) {
                    const ownPropertyNameDescriptor = Object.getOwnPropertyDescriptor(value, ownPropertyName);
                    appendPropertyNode(ownPropertyName, ownPropertyNameDescriptor, {
                      isFunctionPrototype: ownPropertyName === "prototype" && node.isFunction,
                      isClassPrototype: ownPropertyName === "prototype" && node.functionAnalysis.type === "class",
                      isHiddenWhenSame: ownPropertyName === "lastIndex" && node.isRegExp || ownPropertyName === "headers" && node.subgroup === "arg_entry_value",
                      isHiddenWhenSolo: ownPropertyName === "lastIndex" && node.isRegExp
                    });
                  }
                }
              });
            }
            if (objectIntegrityMethodName) {
              compositePartsNode.appendChild("object_integrity_call_close_parenthesis", {
                ...getGrammarProps(),
                group: "grammar",
                value: ")",
                hasLeftSpacingDisabled: true
              });
            }
          },
          group: "entries",
          subgroup: "composite_parts"
        });
      };
      node.wrappedNodeGetter = () => {
        const compositePartsNode = node.childNodeMap.get("parts");
        if (!compositePartsNode) {
          return null;
        }
        const constructNode = compositePartsNode.childNodeMap.get("construct");
        if (constructNode) {
          const constructCallNode = constructNode.childNodeMap.get("call");
          if (constructCallNode) {
            const argEntriesNode = constructCallNode.childNodeMap.get("args");
            const firstArgNode = argEntriesNode.childNodeMap.get(0);
            return firstArgNode;
          }
        }
        const ownPropertiesNode = compositePartsNode.childNodeMap.get("own_properties");
        if (ownPropertiesNode) {
          const symbolToPrimitiveReturnValuePropertyNode = ownPropertiesNode.childNodeMap.get(SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY);
          if (symbolToPrimitiveReturnValuePropertyNode) {
            return getPropertyValueNode(symbolToPrimitiveReturnValuePropertyNode);
          }
          const valueOfReturnValuePropertyNode = ownPropertiesNode.childNodeMap.get(VALUE_OF_RETURN_VALUE_ENTRY_KEY);
          if (valueOfReturnValuePropertyNode) {
            return getPropertyValueNode(valueOfReturnValuePropertyNode);
          }
        }
        return null;
      };
      return node;
    }
    node.category = "primitive";
    return node;
  };
  const renderOptionsDefault = {};
  const referenceFromOthersSetDefault = new Set();
  const appendChildNodeGeneric = (node, childKey, params) => {
    const childNode = createNode({
      id: node.nextId(),
      colorWhenSolo: node.colorWhenSolo,
      colorWhenSame: node.colorWhenSame,
      colorWhenModified: node.colorWhenModified,
      name: node.name,
      parent: node,
      path: node.path,
      referenceMap: node.referenceMap,
      nextId: node.nextId,
      depth: params.group === "entries" || params.group === "entry" || params.isClassPrototype || node.parent?.isClassPrototype ? node.depth : node.depth + 1,
      ...params
    });
    node.childNodeMap.set(childKey, childNode);
    return childNode;
  };
}
const renderValue = (node, props) => {
  if (node.category === "primitive") {
    return renderPrimitive(node, props);
  }
  return renderComposite(node, props);
};
const renderPrimitive = (node, props) => {
  if (props.columnsRemaining < 1) {
    return setColor("…", node.color);
  }
  if (node.isSourceCode) {
    return truncateAndApplyColor("[source code]", node, props);
  }
  if (node.isUndefined) {
    return truncateAndApplyColor("undefined", node, props);
  }
  if (node.isString) {
    return renderString(node, props);
  }
  if (node.isSymbol) {
    return renderSymbol(node, props);
  }
  if (node.isNumber) {
    return renderNumber(node, props);
  }
  if (node.isBigInt) {
    return truncateAndApplyColor("".concat(node.value, "n"), node, props);
  }
  return truncateAndApplyColor(JSON.stringify(node.value), node, props);
};
const renderString = (node, props) => {
  if (node.value === VALUE_OF_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndApplyColor("valueOf()", node, props);
  }
  if (node.value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndApplyColor("[Symbol.toPrimitive()]", node, props);
  }
  const stringPartsNode = node.childNodeMap.get("parts");
  if (stringPartsNode) {
    return stringPartsNode.render(props);
  }
  const {
    quoteMarkerRef,
    value
  } = node;
  let diff = "";
  if (quoteMarkerRef) {
    const quoteToEscape = quoteMarkerRef.current;
    for (const char of value) {
      if (char === quoteToEscape) {
        diff += "\\".concat(char);
      } else {
        diff += char;
      }
    }
  } else {
    diff += value;
  }
  return truncateAndApplyColor(diff, node, props);
};
// - no quote escaping
// - no line splitting
const getGrammarProps = () => {
  return {
    quotesDisabled: true,
    urlStringDetectionDisabled: false,
    dateStringDetectionDisabled: false,
    stringDiffPrecision: "none",
    render: renderString
  };
};
const renderEmptyValue = (node, props) => {
  return truncateAndApplyColor("empty", node, props);
};
const renderChar = (node, props) => {
  let char = node.value;
  const {
    quoteMarkerRef
  } = node;
  if (quoteMarkerRef && char === quoteMarkerRef.current) {
    return truncateAndApplyColor("\\".concat(char), node, props);
  }
  const {
    stringCharMapping = stringCharMappingDefault
  } = node.renderOptions;
  if (stringCharMapping && stringCharMapping.has(char)) {
    char = stringCharMapping.get(char);
  }
  return truncateAndApplyColor(char, node, props);
};
const renderNumber = (node, props) => {
  const numberCompositionNode = node.childNodeMap.get("composition");
  if (numberCompositionNode) {
    return numberCompositionNode.render(props);
  }
  return truncateAndApplyColor(JSON.stringify(node.value), node, props);
};
const renderSymbol = (node, props) => {
  const wellKnownNode = node.childNodeMap.get("well_known");
  if (wellKnownNode) {
    return wellKnownNode.render(props);
  }
  const symbolConstructNode = node.childNodeMap.get("symbol_construct");
  return symbolConstructNode.render(props);
};
const truncateAndApplyColor = (valueDiff, node, props) => {
  const {
    columnsRemaining
  } = props;
  if (columnsRemaining < 1) {
    return props.endSkippedMarkerDisabled ? "" : setColor("…", node.color);
  }
  let columnsRemainingForValue = columnsRemaining;
  let {
    startMarker,
    endMarker
  } = node;
  if (startMarker) {
    columnsRemainingForValue -= startMarker.length;
  }
  if (endMarker) {
    columnsRemainingForValue -= endMarker.length;
  }
  if (columnsRemainingForValue < 1) {
    return props.endSkippedMarkerDisabled ? "" : setColor("…", node.color);
  }
  if (valueDiff.length > columnsRemainingForValue) {
    if (props.endSkippedMarkerDisabled) {
      valueDiff = valueDiff.slice(0, columnsRemainingForValue);
    } else {
      valueDiff = valueDiff.slice(0, columnsRemainingForValue - "…".length);
      valueDiff += "…";
    }
  }
  let diff = "";
  if (startMarker) {
    diff += startMarker;
  }
  diff += valueDiff;
  if (endMarker) {
    diff += endMarker;
  }
  diff = setColor(diff, node.color);
  return diff;
};
const renderComposite = (node, props) => {
  // it's here that at some point we'll compare more than just own properties
  // because composite also got a prototype
  // and a constructor that might differ
  let diff = "";
  if (props.columnsRemaining < 2) {
    diff = setColor("…", node.color);
    return diff;
  }
  const referenceNode = node.childNodeMap.get("reference");
  if (referenceNode) {
    return referenceNode.render(props);
  }
  const wellKnownNode = node.childNodeMap.get("well_known");
  if (wellKnownNode) {
    return wellKnownNode.render(props);
  }
  let maxDepthReached = false;
  if (node.diffType === "same") {
    maxDepthReached = node.depth > props.MAX_DEPTH;
  } else if (typeof props.firstDiffDepth === "number") {
    maxDepthReached = node.depth + props.firstDiffDepth > props.MAX_DEPTH_INSIDE_DIFF;
  } else {
    props.firstDiffDepth = node.depth;
    maxDepthReached = node.depth > props.MAX_DEPTH_INSIDE_DIFF;
  }
  const compositePartsNode = node.childNodeMap.get("parts");
  if (maxDepthReached) {
    node.startMarker = node.endMarker = "";
    if (node.isStringObject) {
      const length = node.value.length;
      return truncateAndApplyColor("".concat(node.objectTag, "(").concat(length, ")"), node, props);
    }
    const indexedEntriesNode = compositePartsNode.childNodeMap.get("indexed_entries");
    if (indexedEntriesNode) {
      const length = indexedEntriesNode.childNodeMap.size;
      return truncateAndApplyColor("".concat(node.objectTag, "(").concat(length, ")"), node, props);
    }
    const ownPropertiesNode = compositePartsNode.childNodeMap.get("own_properties");
    const ownPropertyCount = ownPropertiesNode.childNodeMap.size;
    return truncateAndApplyColor("".concat(node.objectTag, "(").concat(ownPropertyCount, ")"), node, props);
  }
  return compositePartsNode.render(props);
};
const renderChildren = (node, props) => {
  const {
    hasMarkersWhenEmpty,
    focusedChildWhenSame = "first",
    separatorBetweenEachChildDisabled,
    hasSeparatorOnSingleChild,
    hasTrailingSeparator,
    hasSpacingAroundChildren,
    hasSpacingBetweenEachChild,
    skippedMarkers,
    skippedMarkersPlacement = "inside",
    childrenVisitMethod = "pick_around_starting_before"
  } = node.onelineDiff;
  let startSkippedMarker = "";
  let endSkippedMarker = "";
  if (skippedMarkers) {
    startSkippedMarker = skippedMarkers.start;
    endSkippedMarker = skippedMarkers.end;
    if (props.startSkippedMarkerDisabled) {
      startSkippedMarker = "";
    }
    if (props.endSkippedMarkerDisabled) {
      endSkippedMarker = "";
    }
  }
  const renderSkippedSection = (fromIndex, toIndex) => {
    let skippedMarker = fromIndex === 0 ? startSkippedMarker : endSkippedMarker;
    if (!skippedMarker) {
      return "";
    }
    // to pick the color we'll check each child
    let skippedChildIndex = fromIndex;
    let color = node.color;
    while (skippedChildIndex !== toIndex) {
      skippedChildIndex++;
      const skippedChildKey = childrenKeys[skippedChildIndex];
      const skippedChild = node.childNodeMap.get(skippedChildKey);
      if (skippedChild.diffType === "modified") {
        color = skippedChild.color;
        break;
      }
      if (skippedChild.diffType === "solo") {
        color = skippedChild.color;
      }
    }
    let diff = "";
    if (fromIndex > 0 && hasSpacingBetweenEachChild) {
      diff += " ";
    }
    diff += setColor(skippedMarker, color);
    return diff;
  };
  const childrenKeys = node.childrenKeys;
  let columnsRemainingForChildren = props.columnsRemaining;
  if (columnsRemainingForChildren < 1) {
    return renderSkippedSection(0, childrenKeys.length - 1);
  }
  const {
    startMarker,
    endMarker
  } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let minIndex = -1;
  let maxIndex = Infinity;
  let {
    focusedChildIndex
  } = node;
  {
    const {
      rangeToDisplay
    } = node;
    if (rangeToDisplay) {
      if (rangeToDisplay.min !== 0) {
        minIndex = rangeToDisplay.min;
      }
      // maxIndex = rangeToDisplay.end;
      focusedChildIndex = rangeToDisplay.start;
    } else if (focusedChildIndex === undefined) {
      const {
        firstChildWithDiffKey
      } = node;
      if (firstChildWithDiffKey === undefined) {
        // added/removed
        if (node.childComparisonDiffMap.size > 0) {
          focusedChildIndex = childrenKeys.length - 1;
          const {
            otherNode
          } = node;
          if (otherNode.placeholder) ; else if (otherNode.displayedRange) {
            minIndex = otherNode.displayedRange.min;
          } else {
            otherNode.render(props);
            minIndex = otherNode.displayedRange.min;
          }
        }
        // same
        else if (focusedChildWhenSame === "first") {
          focusedChildIndex = 0;
        } else if (focusedChildWhenSame === "last") {
          focusedChildIndex = childrenKeys.length - 1;
        } else {
          focusedChildIndex = Math.floor(childrenKeys.length / 2);
        }
      } else {
        focusedChildIndex = childrenKeys.indexOf(firstChildWithDiffKey);
      }
    }
  }
  let hasSomeChildSkippedAtStart = focusedChildIndex > 0;
  let hasSomeChildSkippedAtEnd = focusedChildIndex < childrenKeys.length - 1;
  const startSkippedMarkerWidth = startSkippedMarker.length;
  const endSkippedMarkerWidth = endSkippedMarker.length;
  const {
    separatorMarker,
    separatorMarkerWhenTruncated
  } = node;
  let boilerplate = "";
  {
    if (hasSomeChildSkippedAtStart) {
      if (skippedMarkersPlacement === "inside") {
        if (hasSpacingAroundChildren) {
          boilerplate = "".concat(startMarker, " ").concat(startSkippedMarker);
        } else {
          boilerplate = "".concat(startMarker).concat(startSkippedMarker);
        }
      } else {
        boilerplate = "".concat(startSkippedMarker).concat(startMarker);
      }
    } else {
      boilerplate = startMarker;
    }
    if (hasSomeChildSkippedAtEnd) {
      if (skippedMarkersPlacement === "inside") {
        if (hasSpacingAroundChildren) {
          boilerplate += "".concat(endSkippedMarker, " ").concat(endMarker);
        } else {
          boilerplate += "".concat(endSkippedMarker).concat(endMarker);
        }
      } else {
        boilerplate += "".concat(endMarker).concat(endSkippedMarker);
      }
    } else {
      boilerplate += endMarker;
    }
    if (separatorMarker) {
      boilerplate += separatorMarker;
    }
    const columnsRemainingForChildrenConsideringBoilerplate = columnsRemainingForChildren - boilerplate.length;
    if (columnsRemainingForChildrenConsideringBoilerplate < 0) {
      return renderSkippedSection(0, childrenKeys.length - 1);
    }
    if (columnsRemainingForChildrenConsideringBoilerplate === 0) {
      return skippedMarkersPlacement === "inside" ? setColor(boilerplate, node.color) : renderSkippedSection(0, childrenKeys.length - 1);
    }
  }
  let childrenDiff = "";
  let tryToSwapSkipMarkerWithChild = false;
  let columnsNeededBySkipMarkers = 0;
  let isFirstAppend = true;
  const appendChildDiff = (childDiff, childIndex) => {
    if (isFirstAppend) {
      isFirstAppend = false;
      minIndexDisplayed = maxIndexDisplayed = childIndex;
      return childDiff;
    }
    if (childIndex < minIndexDisplayed) {
      minIndexDisplayed = childIndex;
    } else if (childIndex > maxIndexDisplayed) {
      maxIndexDisplayed = childIndex;
    }
    const isPrevious = childIndex < focusedChildIndex;
    if (isPrevious) {
      if (childrenDiff) {
        return "".concat(childDiff).concat(childrenDiff);
      }
      return childDiff;
    }
    if (childrenDiff) {
      return "".concat(childrenDiff).concat(childDiff);
    }
    return childDiff;
  };
  if (hasSpacingAroundChildren) {
    columnsRemainingForChildren -= "".concat(startMarker, "  ").concat(endMarker).concat(separatorMarkerWhenTruncated ? separatorMarkerWhenTruncated : separatorMarker).length;
  } else {
    columnsRemainingForChildren -= "".concat(startMarker).concat(endMarker).concat(separatorMarkerWhenTruncated ? separatorMarkerWhenTruncated : separatorMarker).length;
  }
  let minIndexDisplayed = Infinity;
  let maxIndexDisplayed = -1;
  for (const childIndex of generateChildIndexes(childrenKeys, {
    startIndex: focusedChildIndex,
    minIndex,
    maxIndex,
    childrenVisitMethod
  })) {
    if (columnsRemainingForChildren <= 0) {
      break;
    }
    const childKey = childrenKeys[childIndex];
    const childNode = node.childNodeMap.get(childKey);
    if (!childNode) {
      // happens when forcing a specific range to be rendered
      continue;
    }
    const minIndexDisplayedCandidate = childIndex < minIndexDisplayed ? childIndex : minIndexDisplayed;
    const maxIndexDisplayedCandidate = childIndex > maxIndexDisplayed ? childIndex : maxIndexDisplayed;
    const hasSomeChildSkippedAtStartCandidate = minIndexDisplayedCandidate !== 0;
    const hasSomeChildSkippedAtEndCandidate = maxIndexDisplayedCandidate !== childrenKeys.length - 1;
    columnsNeededBySkipMarkers = 0;
    if (hasSomeChildSkippedAtStartCandidate) {
      columnsNeededBySkipMarkers += startSkippedMarkerWidth;
    }
    if (hasSomeChildSkippedAtEndCandidate) {
      if (hasSpacingBetweenEachChild) {
        columnsNeededBySkipMarkers += " ".length;
      }
      columnsNeededBySkipMarkers += endSkippedMarkerWidth;
    }
    let columnsRemainingForThisChild;
    if (tryToSwapSkipMarkerWithChild) {
      // "ab" makes more sense than "a…"
      // So if next child is the last and not too large
      // it will be allowed to fully replace the skip marker
      // But we must allow next child to take as much space as it needs
      // (hence we reset columnsRemainingForThisChild)
      // Otherwise it will be truncated and we'll think it take exactly the skip marker width
      // (That would lead to "http://example.com/dir/file.js" becoming "http://example/" instead of "http://example…")
      columnsRemainingForThisChild = props.columnsRemaining;
    } else {
      columnsRemainingForThisChild = columnsRemainingForChildren;
    }
    columnsRemainingForThisChild -= columnsNeededBySkipMarkers;
    let {
      separatorMarker,
      separatorMarkerWhenTruncated,
      separatorMarkerDisabled
    } = childNode;
    if (separatorMarkerDisabled) ; else if (separatorBetweenEachChildDisabled || shouldDisableSeparator(childIndex, childrenKeys, {
      hasSeparatorOnSingleChild,
      hasTrailingSeparator
    })) {
      separatorMarkerDisabled = true;
      if (childNode.subgroup === "property_entry") {
        disableSeparatorOnProperty(childNode);
      }
    }
    if (separatorMarkerWhenTruncated === undefined) {
      columnsRemainingForThisChild -= separatorMarkerDisabled ? 0 : separatorMarker.length;
    } else {
      columnsRemainingForThisChild -= separatorMarkerWhenTruncated.length;
    }
    const canSkipMarkers = node.subgroup === "url_parts" || node.subgroup === "date_parts" || node.subgroup === "array_entries";
    let childDiff = childNode.render({
      ...props,
      columnsRemaining: columnsRemainingForThisChild,
      startSkippedMarkerDisabled: canSkipMarkers && hasSomeChildSkippedAtStart && startSkippedMarkerWidth,
      endSkippedMarkerDisabled: canSkipMarkers && hasSomeChildSkippedAtEnd && endSkippedMarkerWidth,
      separatorMarker,
      forceDisableSeparatorMarker: () => {
        separatorMarkerDisabled = true;
      }
    });
    if (childDiff === "" && childNode.subgroup !== "own_properties") {
      // child has been truncated (well we can't tell 100% this is the reason)
      // but for now let's consider this to be true
      break;
    }
    let childDiffWidth;
    const newLineIndex = childDiff.indexOf("\n");
    if (newLineIndex === -1) {
      childDiffWidth = stringWidth(childDiff);
    } else {
      const newLineLastIndex = childDiff.lastIndexOf("\n");
      if (newLineLastIndex === newLineIndex) {
        const line = childDiff.slice(0, newLineIndex + "\n".length);
        childDiffWidth = stringWidth(line);
      } else {
        const lastLine = childDiff.slice(newLineLastIndex + "\n".length);
        childDiffWidth = stringWidth(lastLine);
      }
    }
    let separatorMarkerToAppend;
    let separatorWhenTruncatedUsed = false;
    if (separatorMarkerWhenTruncated === undefined) {
      separatorMarkerToAppend = separatorMarkerDisabled ? "" : separatorMarker;
    } else {
      const remainingColumns = columnsRemainingForChildren - childDiffWidth;
      if (remainingColumns > separatorMarker.length + 1) {
        separatorMarkerToAppend = separatorMarkerDisabled ? "" : separatorMarker;
      } else {
        separatorMarkerToAppend = separatorMarkerWhenTruncated;
        separatorWhenTruncatedUsed = true;
      }
    }
    if (separatorMarkerToAppend) {
      if (childNode.diffType === "solo") {
        childDiffWidth += separatorMarkerToAppend.length;
        childDiff += setColor(separatorMarkerToAppend, childNode.color);
      } else {
        childDiffWidth += separatorMarkerToAppend.length;
        childDiff += setColor(separatorMarkerToAppend, node.color);
      }
    }
    if (!isFirstAppend && hasSpacingBetweenEachChild && childDiff) {
      if (childIndex < focusedChildIndex) {
        if ((childIndex > 0 || focusedChildIndex > 0) && childrenDiff && !childNode.hasRightSpacingDisabled) {
          let shouldInjectSpacing = true;
          const nextChildIndex = childIndex + 1;
          const nextChildKey = childrenKeys[nextChildIndex];
          if (nextChildKey !== undefined) {
            const nextChildNode = node.childNodeMap.get(nextChildKey);
            if (nextChildNode.hasLeftSpacingDisabled) {
              shouldInjectSpacing = false;
            }
          }
          if (shouldInjectSpacing) {
            childDiffWidth += " ".length;
            childDiff = "".concat(childDiff, " ");
          }
        }
      } else if (!childNode.hasLeftSpacingDisabled) {
        let shouldInjectSpacing = true;
        const previousChildIndex = childIndex - 1;
        const previousChildKey = childrenKeys[previousChildIndex];
        if (previousChildKey !== undefined) {
          const previousChildNode = node.childNodeMap.get(previousChildKey);
          if (previousChildNode.hasRightSpacingDisabled) {
            shouldInjectSpacing = false;
          }
        }
        if (shouldInjectSpacing) {
          childDiffWidth += " ".length;
          childDiff = " ".concat(childDiff);
        }
      }
    }
    if (childDiffWidth > columnsRemainingForChildren) {
      break;
    }
    if (childDiffWidth + columnsNeededBySkipMarkers > columnsRemainingForChildren) {
      break;
    }
    hasSomeChildSkippedAtStart = hasSomeChildSkippedAtStartCandidate;
    hasSomeChildSkippedAtEnd = hasSomeChildSkippedAtEndCandidate;
    columnsRemainingForChildren -= childDiffWidth;
    childrenDiff = appendChildDiff(childDiff, childIndex);
    if (separatorWhenTruncatedUsed) {
      break;
    }
    // if I had to stop there, I would put some markers
    // so I need to reserve that space
    // if I have exactly the spot I can still try to replace
    // skip marker by the actual next/prev child
    // ONLY if it can replace the marker (it's the first/last child)
    // AND it does take less or same width as marker
    if (columnsNeededBySkipMarkers > 0 && columnsNeededBySkipMarkers === columnsRemainingForChildren) {
      if (tryToSwapSkipMarkerWithChild) {
        // can we try again?
        break;
      }
      tryToSwapSkipMarkerWithChild = true;
    }
  }
  node.displayedRange = {
    min: minIndexDisplayed,
    start: focusedChildIndex,
    max: maxIndexDisplayed
  };
  if (minIndexDisplayed === Infinity || maxIndexDisplayed === -1) {
    return skippedMarkersPlacement === "inside" ? setColor(boilerplate, node.color) : renderSkippedSection(0, childrenKeys.length - 1);
  }
  let diff = "";
  if (hasSomeChildSkippedAtStart) {
    if (skippedMarkersPlacement === "inside") {
      if (startMarker) {
        diff += setColor(startMarker, node.color);
      }
      diff += renderSkippedSection(0, minIndexDisplayed);
    } else {
      diff += renderSkippedSection(0, minIndexDisplayed);
      if (startMarker) {
        diff += setColor(startMarker, node.color);
      }
    }
  } else if (startMarker) {
    diff += setColor(startMarker, node.color);
  }
  if (hasSpacingAroundChildren) {
    diff += " ";
  }
  diff += childrenDiff;
  if (hasSpacingAroundChildren) {
    diff += " ";
  }
  if (hasSomeChildSkippedAtEnd) {
    if (skippedMarkersPlacement === "inside") {
      diff += renderSkippedSection(maxIndexDisplayed + 1, childrenKeys.length - 1);
      if (endMarker) {
        diff += setColor(endMarker, node.color);
      }
    } else {
      if (endMarker) {
        diff += setColor(endMarker, node.color);
      }
      diff += renderSkippedSection(maxIndexDisplayed + 1, childrenKeys.length - 1);
    }
  } else if (endMarker) {
    diff += setColor(endMarker, node.color);
  }
  return diff;
};
function* generateChildIndexes(childrenKeys, {
  startIndex,
  minIndex,
  maxIndex,
  // "pick_around_starting_before"
  // "pick_around_starting_after"
  // "all_before_then_all_after"
  // "all_after_then_all_before"
  childrenVisitMethod
}) {
  yield startIndex;
  if (childrenVisitMethod === "all_before_then_all_after") {
    let beforeAttempt = 0;
    while (true) {
      const beforeChildIndex = startIndex - beforeAttempt - 1;
      if (beforeChildIndex === minIndex - 1) {
        break;
      }
      if (beforeChildIndex < 0) {
        break;
      }
      beforeAttempt++;
      yield beforeChildIndex;
    }
    let afterAttempt = 0;
    while (true) {
      const afterChildIndex = startIndex + afterAttempt + 1;
      if (afterChildIndex === maxIndex - 1) {
        break;
      }
      if (afterChildIndex >= childrenKeys.length) {
        break;
      }
      afterAttempt++;
      yield afterChildIndex;
    }
    return;
  }
  if (childrenVisitMethod === "all_after_then_all_before") {
    let afterAttempt = 0;
    while (true) {
      const afterChildIndex = startIndex + afterAttempt + 1;
      if (afterChildIndex === maxIndex - 1) {
        break;
      }
      if (afterChildIndex >= childrenKeys.length) {
        break;
      }
      afterAttempt++;
      yield afterChildIndex;
    }
    let beforeAttempt = 0;
    while (true) {
      const beforeChildIndex = startIndex - beforeAttempt - 1;
      if (beforeChildIndex === minIndex - 1) {
        break;
      }
      if (beforeChildIndex < 0) {
        break;
      }
      beforeAttempt++;
      yield beforeChildIndex;
    }
    return;
  }
  let previousAttempt = 0;
  let nextAttempt = 0;
  let tryBeforeFirst = childrenVisitMethod === "pick_around_starting_before";
  while (true) {
    const previousChildIndex = startIndex - previousAttempt - 1;
    const hasPreviousChild = previousChildIndex === minIndex - 1 ? false : previousChildIndex >= 0;
    const nextChildIndex = startIndex + nextAttempt + 1;
    const hasNextChild = nextChildIndex === maxIndex - 1 ? false : nextChildIndex < childrenKeys.length;
    if (!hasPreviousChild && !hasNextChild) {
      break;
    }
    if (hasPreviousChild && hasNextChild) {
      if (tryBeforeFirst) {
        previousAttempt++;
        yield previousChildIndex;
        nextAttempt++;
        yield nextChildIndex;
      } else {
        nextAttempt++;
        yield nextChildIndex;
        previousAttempt++;
        yield previousChildIndex;
      }
    } else if (hasPreviousChild) {
      previousAttempt++;
      yield previousChildIndex;
      tryBeforeFirst = false;
    } else {
      nextAttempt++;
      yield nextChildIndex;
      tryBeforeFirst = childrenVisitMethod === "pick_around_starting_before";
    }
  }
}
const renderChildrenMultilineWhenDiff = (node, props) => {
  if (node.diffType === "solo") {
    return renderChildrenMultiline(node, props);
  }
  if (node.childComparisonDiffMap.size > 0) {
    return renderChildrenMultiline(node, props);
  }
  return renderChildren(node, props);
};
/*
Rewrite "renderChildrenMultiline" so that:
- We start to render from the first child with a diff
and we discover around
then if we need to skip we append skipp stuff

the goal is that for lines we will first render the first line with a diff
as this line will impose to the surrounding lines where the focus will be
*/
const renderChildrenMultiline = (node, props) => {
  const childrenKeys = node.childrenKeys;
  const {
    separatorBetweenEachChildDisabled = false,
    hasSeparatorOnSingleChild = true,
    hasTrailingSeparator,
    hasNewLineAroundChildren,
    hasIndentBeforeEachChild,
    hasIndentBetweenEachChild,
    hasMarkersWhenEmpty,
    maxDiffType = "prop"
  } = node.multilineDiff;
  const {
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF
  } = props;
  const maxDiff = typeof MAX_DIFF_INSIDE_VALUE === "number" ? MAX_DIFF_INSIDE_VALUE : MAX_DIFF_INSIDE_VALUE[maxDiffType];
  const maxChildBeforeDiff = typeof MAX_CONTEXT_BEFORE_DIFF === "number" ? MAX_CONTEXT_BEFORE_DIFF : MAX_CONTEXT_BEFORE_DIFF[maxDiffType];
  const maxChildAfterDiff = typeof MAX_CONTEXT_AFTER_DIFF === "number" ? MAX_CONTEXT_AFTER_DIFF : MAX_CONTEXT_AFTER_DIFF[maxDiffType];
  let focusedChildIndex = 0;
  const childIndexToDisplayArray = [];
  index_to_display: {
    if (childrenKeys.length === 0) {
      break index_to_display;
    }
    if (maxDiff === Infinity) {
      let index = 0;
      // eslint-disable-next-line no-unused-vars
      for (const key of childrenKeys) {
        childIndexToDisplayArray.push(index);
        index++;
      }
      break index_to_display;
    }
    let diffCount = 0;
    const visitChild = childIndex => {
      const childKey = childrenKeys[childIndex];
      const childNode = node.childNodeMap.get(childKey);
      if (!childNode.comparison.hasAnyDiff) {
        return false;
      }
      if (isSourceCodeProperty(childNode)) ; else {
        diffCount++;
      }
      return true;
    };
    if (node.firstChildWithDiffKey === undefined) {
      focusedChildIndex = 0;
    } else {
      focusedChildIndex = childrenKeys.indexOf(node.firstChildWithDiffKey);
    }
    let childIndex = focusedChildIndex;
    while (
    // eslint-disable-next-line no-unmodified-loop-condition
    diffCount < maxDiff) {
      let currentChildHasDiff = visitChild(childIndex);
      if (currentChildHasDiff) {
        before: {
          const beforeDiffRemainingCount = maxChildBeforeDiff;
          if (beforeDiffRemainingCount < 1) {
            break before;
          }
          let fromIndex = childIndex - beforeDiffRemainingCount;
          let toIndex = childIndex;
          if (fromIndex < 0) {
            fromIndex = 0;
          } else {
            if (childIndexToDisplayArray.length) {
              const previousChildIndexToDisplay = childIndexToDisplayArray[childIndexToDisplayArray.length - 1];
              if (previousChildIndexToDisplay + 1 === fromIndex) {
                // prevent skip length of 1
                childIndexToDisplayArray.push(previousChildIndexToDisplay + 1);
              }
            }
            if (fromIndex > 0) {
              fromIndex++;
            }
          }
          let index = fromIndex;
          while (index !== toIndex) {
            if (childIndexToDisplayArray.includes(index)) ; else {
              visitChild(index);
              childIndexToDisplayArray.push(index);
            }
            index++;
          }
        }
        childIndexToDisplayArray.push(childIndex);
        after: {
          const afterDiffRemainingCount = maxChildAfterDiff;
          if (afterDiffRemainingCount < 1) {
            break after;
          }
          let fromIndex = childIndex + 1;
          let toIndex = childIndex + 1 + afterDiffRemainingCount;
          if (toIndex > childrenKeys.length) {
            toIndex = childrenKeys.length;
          } else if (toIndex !== childrenKeys.length) {
            toIndex--;
          }
          let index = fromIndex;
          while (index !== toIndex) {
            if (childIndexToDisplayArray.includes(index)) ; else {
              currentChildHasDiff = visitChild(index);
              childIndexToDisplayArray.push(index);
              childIndex = index;
            }
            index++;
          }
        }
      } else if (childIndex === focusedChildIndex) {
        childIndexToDisplayArray.push(focusedChildIndex);
      }
      if (childIndex === childrenKeys.length - 1) {
        break;
      }
      childIndex++;
      continue;
    }
  }
  if (node.beforeRender) {
    node.beforeRender(props, {
      focusedChildIndex,
      childIndexToDisplayArray
    });
  }
  const {
    startMarker,
    endMarker
  } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let childrenDiff = "";
  const renderedRange = {
    start: Infinity,
    end: -1
  };
  let firstAppend = true;
  const appendChildDiff = (childDiff, childIndex) => {
    if (firstAppend) {
      firstAppend = false;
      renderedRange.start = renderedRange.end = childIndex;
      return childDiff;
    }
    if (childIndex < renderedRange.start) {
      renderedRange.start = childIndex;
      return "".concat(childDiff, "\n").concat(childrenDiff);
    }
    renderedRange.end = childIndex;
    return "".concat(childrenDiff, "\n").concat(childDiff);
  };
  const appendSkippedSection = (fromIndex, toIndex) => {
    const skippedMarkers = node.multilineDiff.skippedMarkers || {
      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
      between: ["↕ 1 value ↕", "↕ {x} values ↕"],
      end: ["↓ 1 value ↓", "↓ {x} values ↓"]
    };
    const skippedCount = toIndex - fromIndex;
    let skippedChildIndex = fromIndex;
    let modifiedCount = 0;
    let soloCount = 0;
    let modifiedColor;
    let soloColor;
    while (skippedChildIndex !== toIndex) {
      skippedChildIndex++;
      const skippedChildKey = childrenKeys[skippedChildIndex];
      const skippedChild = node.childNodeMap.get(skippedChildKey);
      if (skippedChild.diffType === "modified") {
        modifiedCount++;
        modifiedColor = skippedChild.color;
      }
      if (skippedChild.diffType === "solo") {
        soloCount++;
        soloColor = skippedChild.color;
      }
    }
    const allModified = modifiedCount === skippedCount;
    const allSolo = soloCount === skippedCount;
    let skippedDiff = "";
    if (hasIndentBeforeEachChild) {
      skippedDiff += "  ".repeat(getNodeDepth(node, props) + 1);
    }
    let skippedMarker;
    if (fromIndex < renderedRange.start) {
      skippedMarker = skippedMarkers.start;
    } else {
      if (hasIndentBetweenEachChild) {
        skippedDiff += " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      }
      if (toIndex < childrenKeys.length - 1) {
        skippedMarker = skippedMarkers.between;
      } else {
        skippedMarker = skippedMarkers.end;
      }
    }
    if (skippedCount === 1) {
      skippedDiff += setColor(skippedMarker[0], allModified ? modifiedColor : allSolo ? soloColor : node.color);
    } else {
      skippedDiff += setColor(skippedMarker[1].replace("{x}", skippedCount), allModified ? modifiedColor : allSolo ? soloColor : node.color);
    }
    const details = [];
    if (modifiedCount && modifiedCount !== skippedCount) {
      details.push(setColor("".concat(modifiedCount, " modified"), modifiedColor));
    }
    if (soloCount && soloCount !== skippedCount) {
      details.push(node.name === "actual" ? setColor("".concat(soloCount, " added"), soloColor) : setColor("".concat(soloCount, " removed"), soloColor));
    }
    if (details.length) {
      skippedDiff += " ";
      skippedDiff += setColor("(", node.color);
      skippedDiff += details.join(", ");
      skippedDiff += setColor(")", node.color);
    }
    childrenDiff = appendChildDiff(skippedDiff, toIndex === childrenKeys.length - 1 ? toIndex : fromIndex);
  };
  const renderChildDiff = (childNode, childIndex) => {
    let childDiff = "";
    let columnsRemainingForThisChild = childIndex > 0 || hasNewLineAroundChildren ? props.MAX_COLUMNS : props.columnsRemaining;
    if (hasIndentBeforeEachChild) {
      const indent = "  ".repeat(getNodeDepth(node, props) + 1);
      columnsRemainingForThisChild -= indent.length;
      childDiff += indent;
    }
    if (hasIndentBetweenEachChild && childIndex !== 0) {
      const indent = " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      columnsRemainingForThisChild -= indent.length;
      childDiff += indent;
    }
    let {
      separatorMarker,
      separatorMarkerWhenTruncated,
      separatorMarkerDisabled
    } = childNode;
    if (separatorMarkerDisabled) ; else if (separatorBetweenEachChildDisabled || shouldDisableSeparator(childIndex, childrenKeys, {
      hasTrailingSeparator,
      hasSeparatorOnSingleChild
    })) {
      separatorMarkerDisabled = true;
      if (childNode.subgroup === "property_entry") {
        disableSeparatorOnProperty(childNode);
      }
    } else if (childNode.subgroup === "property_entry") {
      enableSeparatorOnSingleProperty(childNode);
    }
    if (separatorMarkerWhenTruncated === undefined) {
      columnsRemainingForThisChild -= separatorMarker.length;
    } else {
      columnsRemainingForThisChild -= separatorMarkerWhenTruncated.length;
    }
    if (childNode.subgroup === "line_entry_value") {
      if (childIndex === focusedChildIndex) {
        childDiff += childNode.render({
          ...props,
          columnsRemaining: columnsRemainingForThisChild
        });
      } else {
        childNode.rangeToDisplay = focusedChildNode.displayedRange;
        childDiff += childNode.render({
          ...props,
          columnsRemaining: columnsRemainingForThisChild
        });
      }
    } else {
      childDiff += childNode.render({
        ...props,
        columnsRemaining: columnsRemainingForThisChild
      });
    }
    let separatorMarkerToAppend;
    if (separatorMarkerWhenTruncated === undefined) {
      separatorMarkerToAppend = separatorMarker;
    } else {
      const remainingColumns = columnsRemainingForThisChild - stringWidth(childDiff);
      if (remainingColumns > separatorMarker.length + 1) {
        separatorMarkerToAppend = separatorMarkerDisabled ? "" : separatorMarker;
      } else {
        separatorMarkerToAppend = separatorMarkerWhenTruncated;
      }
    }
    if (separatorMarkerToAppend) {
      if (childNode.diffType === "solo") {
        childDiff += setColor(separatorMarkerToAppend, childNode.color);
      } else {
        childDiff += setColor(separatorMarkerToAppend, node.color);
      }
    }
    return childDiff;
  };
  const focusedChildKey = childrenKeys[focusedChildIndex];
  const focusedChildNode = node.childNodeMap.get(focusedChildKey);
  const focusedChildDiff = renderChildDiff(focusedChildNode, focusedChildIndex);
  const [firstChildIndexToDisplay] = childIndexToDisplayArray;
  if (firstChildIndexToDisplay > 0) {
    appendSkippedSection(0, firstChildIndexToDisplay);
  }
  let previousChildIndexDisplayed;
  for (const childIndexToDisplay of childIndexToDisplayArray) {
    if (previousChildIndexDisplayed !== undefined && childIndexToDisplay !== previousChildIndexDisplayed + 1) {
      appendSkippedSection(previousChildIndexDisplayed, childIndexToDisplay - 1);
    }
    if (childIndexToDisplay === focusedChildIndex) {
      childrenDiff = appendChildDiff(focusedChildDiff, childIndexToDisplay);
    } else {
      const childKey = childrenKeys[childIndexToDisplay];
      const childNode = node.childNodeMap.get(childKey);
      const childDiff = renderChildDiff(childNode, childIndexToDisplay);
      childrenDiff = appendChildDiff(childDiff, childIndexToDisplay);
    }
    previousChildIndexDisplayed = childIndexToDisplay;
  }
  if (childrenKeys.length > 1 && previousChildIndexDisplayed !== childrenKeys.length - 1) {
    appendSkippedSection(previousChildIndexDisplayed, childrenKeys.length - 1);
  }
  let diff = "";
  diff += setColor(startMarker, node.color);
  if (hasNewLineAroundChildren) {
    diff += "\n";
  }
  diff += childrenDiff;
  if (hasNewLineAroundChildren) {
    diff += "\n";
    diff += "  ".repeat(getNodeDepth(node, props));
  }
  diff += setColor(endMarker, node.color);
  return diff;
};
const getNodeDepth = (node, props) => {
  return node.depth - props.startNode.depth;
};
const enableMultilineDiff = lineEntriesNode => {
  lineEntriesNode.multilineDiff.hasIndentBetweenEachChild = !lineEntriesNode.multilineDiff.lineNumbersDisabled;
  lineEntriesNode.beforeRender = (props, {
    childIndexToDisplayArray
  }) => {
    if (props.forceDisableSeparatorMarker) {
      props.columnsRemaining += props.separatorMarker.length;
      props.forceDisableSeparatorMarker();
    }
    const biggestDisplayedLineIndex = childIndexToDisplayArray[childIndexToDisplayArray.length - 1];
    for (const lineIndexToDisplay of childIndexToDisplayArray) {
      const lineNode = lineEntriesNode.childNodeMap.get(lineIndexToDisplay);
      lineNode.onelineDiff.hasMarkersWhenEmpty = true;
      if (!lineEntriesNode.multilineDiff.lineNumbersDisabled) {
        lineNode.startMarker = renderLineStartMarker(lineNode, biggestDisplayedLineIndex);
      }
    }
  };
  const firstLineNode = lineEntriesNode.childNodeMap.get(0);
  firstLineNode.onelineDiff.hasMarkersWhenEmpty = false;
  firstLineNode.onelineDiff.skippedMarkersPlacement = "inside";
  firstLineNode.startMarker = firstLineNode.endMarker = "";
};
const forceSameQuotes = (actualNode, expectNode) => {
  const actualQuoteMarkerRef = actualNode.quoteMarkerRef;
  const expectQuoteMarkerRef = expectNode.quoteMarkerRef;
  const actualQuote = actualQuoteMarkerRef ? actualQuoteMarkerRef.current : "";
  const expectQuote = expectQuoteMarkerRef ? expectQuoteMarkerRef.current : "";
  if (actualQuote === '"' && expectQuote !== '"') {
    actualQuoteMarkerRef.current = expectQuote;
    actualNode.startMarker = actualNode.endMarker = expectQuote;
  } else if (actualQuote !== expectQuote) {
    expectQuoteMarkerRef.current = actualQuote;
    expectNode.startMarker = expectNode.endMarker = actualQuote;
  }
};
const renderLineStartMarker = (lineNode, biggestDisplayedLineIndex) => {
  const lineNumberString = String(lineNode.key + 1);
  const biggestDisplayedLineNumberString = String(biggestDisplayedLineIndex + 1);
  if (biggestDisplayedLineNumberString.length > lineNumberString.length) {
    return " ".concat(lineNumberString, "| ");
  }
  return "".concat(lineNumberString, "| ");
};
const createMethodCallNode = (node, {
  objectName,
  methodName,
  args,
  renderOnlyArgs
}) => {
  return {
    render: renderChildren,
    onelineDiff: {
      hasTrailingSeparator: true
    },
    group: "entries",
    subgroup: "method_call",
    childGenerator: methodCallNode => {
      methodCallNode.appendChild("object_name", {
        ...getGrammarProps(),
        group: "object_name",
        value: objectName
      });
      if (methodName) {
        methodCallNode.appendChild("method_dot", {
          ...getGrammarProps(),
          group: "method_dot",
          value: "."
        });
        methodCallNode.appendChild("method_name", {
          ...getGrammarProps(),
          group: "method_name",
          value: methodName
        });
      }
      methodCallNode.appendChild("args", createArgEntriesNode(methodCallNode, {
        renderOnlyArgs,
        args
      }));
    }
  };
};
const createArgEntriesNode = (node, {
  args,
  renderOnlyArgs
}) => {
  return {
    render: renderChildren,
    startMarker: "(",
    endMarker: ")",
    onelineDiff: {
      hasMarkersWhenEmpty: true,
      hasSpacingBetweenEachChild: true
    },
    ...(renderOnlyArgs ? {} : {}),
    group: "entries",
    subgroup: "arg_entries",
    childGenerator: callNode => {
      const appendArgEntry = (argIndex, argValue, {
        key,
        ...valueParams
      }) => {
        callNode.appendChild(argIndex, {
          group: "entry_value",
          subgroup: "arg_entry_value",
          value: argValue,
          render: renderValue,
          separatorMarker: ",",
          path: node.path.append(key || argIndex),
          depth: node.depth,
          ...valueParams
        });
      };
      let argIndex = 0;
      for (const {
        value,
        ...argParams
      } of args) {
        appendArgEntry(argIndex, value, argParams);
        argIndex++;
      }
    }
  };
};
const DOUBLE_QUOTE = "\"";
const SINGLE_QUOTE = "'";
const BACKTICK = "`";
const getAddedOrRemovedReason = node => {
  if (node.group === "url_part") {
    return node.subgroup;
  }
  if (node.group === "date_part") {
    return node.subgroup;
  }
  if (node.group === "time_part") {
    return node.subgroup;
  }
  if (node.category === "entry") {
    return node.key;
  }
  if (node.category === "entry_key") {
    return node.value;
  }
  if (node.category === "entry_value") {
    return getAddedOrRemovedReason(node.parent);
  }
  return "unknown";
};
const getWrappedNode = (node, predicate) => {
  const wrappedNode = node.wrappedNodeGetter();
  if (!wrappedNode) {
    return null;
  }
  if (predicate(wrappedNode)) {
    return wrappedNode;
  }
  // can happen for
  // valueOf: () => {
  //   return { valueOf: () => 10 }
  // }
  const nested = getWrappedNode(wrappedNode, predicate);
  if (nested) {
    return nested;
  }
  return null;
};
// const asCompositeNode = (node) =>
//   getWrappedNode(
//     node,
//     (wrappedNodeCandidate) => wrappedNodeCandidate.group === "composite",
//   );
const asPrimitiveNode = node => getWrappedNode(node, wrappedNodeCandidate => wrappedNodeCandidate.category === "primitive");
const getPropertyValueNode = node => {
  if (node.subgroup !== "property_entry") {
    return null;
  }
  const valueDescriptorNode = node.childNodeMap.get("value");
  if (!valueDescriptorNode) {
    return null;
  }
  return valueDescriptorNode.childNodeMap.get("entry_value");
};
const isSourceCodeProperty = node => {
  const propertyValueNode = getPropertyValueNode(node);
  return propertyValueNode && propertyValueNode.isSourceCode;
};
const disableSeparatorOnProperty = node => {
  for (const [, descriptorNode] of node.childNodeMap) {
    const propertyDescriptorValueNode = descriptorNode.childNodeMap.get("entry_value");
    propertyDescriptorValueNode.separatorMarkerDisabled = true;
  }
};
const enableSeparatorOnSingleProperty = node => {
  for (const [, descriptorNode] of node.childNodeMap) {
    if (descriptorNode.onelineDiff) {
      descriptorNode.onelineDiff.hasSeparatorOnSingleChild = true;
    }
  }
};
const shouldIgnoreOwnPropertyName = (node, ownPropertyName) => {
  if (ownPropertyName === "prototype") {
    // ignore prototype if it's the default prototype
    // created by the runtime
    const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(node.value, ownPropertyName);
    if (!Object.hasOwn(ownPropertyDescriptor, "value")) {
      return false;
    }
    const prototypeValue = ownPropertyDescriptor.value;
    if (node.isArrowFunction) {
      return prototypeValue === undefined;
    }
    if (node.isAsyncFunction && !node.isGeneratorFunction) {
      return prototypeValue === undefined;
    }
    if (!isComposite(prototypeValue)) {
      return false;
    }
    const constructorDescriptor = Object.getOwnPropertyDescriptor(prototypeValue, "constructor");
    if (!constructorDescriptor) {
      return false;
    }
    // the default prototype.constructor is
    // configurable, writable, non enumerable and got a value
    if (!constructorDescriptor.configurable || !constructorDescriptor.writable || constructorDescriptor.enumerable || constructorDescriptor.set || constructorDescriptor.get) {
      return false;
    }
    const constructorValue = constructorDescriptor.value;
    if (constructorValue !== node.value) {
      return false;
    }
    const propertyNames = Object.getOwnPropertyNames(prototypeValue);
    return propertyNames.length === 1;
  }
  if (ownPropertyName === "constructor") {
    // if (
    //   node.parent.key === "prototype" &&
    //   node.parent.parent.isFunction &&
    //   Object.hasOwn(ownPropertyDescriptor, "value") &&
    //   ownPropertyDescriptor.value === node.parent.parent.value
    // ) {
    return true;
    //  }
    //  break ignore;
  }
  return false;
};
const shouldIgnoreOwnPropertySymbol = (node, ownPropertySymbol) => {
  if (ownPropertySymbol === Symbol.toStringTag) {
    const propertySymbolDescriptor = Object.getOwnPropertyDescriptor(node.value, Symbol.toStringTag);
    if (Object.hasOwn(propertySymbolDescriptor, "value")) {
      // toStringTag is already reflected on subtype
      return true;
    }
    return false;
  }
  const keyForSymbol = Symbol.keyFor(ownPropertySymbol);
  const symbolDescription = symbolToDescription(ownPropertySymbol);
  if (node.isPromise) {
    if (keyForSymbol) {
      return false;
    }
    if (symbolDescription === "async_id_symbol") {
      // nodejs runtime puts a custom Symbol on promise
      return true;
    }
    return false;
  }
  if (node.isHeaders) {
    if (keyForSymbol) {
      return false;
    }
    // nodejs runtime put custom symbols on Headers
    if (["guard", "headers list", "realm"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.isAbortSignal) {
    if (keyForSymbol) {
      return false;
    }
    if (["realm", "kAborted", "kReason", "kEvents", "events.maxEventTargetListeners", "events.maxEventTargetListenersWarned", "kHandlers", "kComposite"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.isRequest) {
    if (Symbol.keyFor(ownPropertySymbol)) {
      return false;
    }
    // nodejs runtime put custom symbols on Request
    if (["state", "signal", "abortController", "headers"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.isResponse) {
    if (Symbol.keyFor(ownPropertySymbol)) {
      return false;
    }
    if (["state", "headers"].includes(symbolDescription)) {
      return true;
    }
  }
  if (node.objectTag === "ReadableStream") {
    const keyForSymbol = Symbol.keyFor(ownPropertySymbol);
    if (keyForSymbol && keyForSymbol.startsWith("nodejs.webstream.")) {
      return true;
    }
    if (["kType", "kState"].includes(symbolDescription)) {
      return true;
    }
  }
  return false;
};
const shouldIgnoreOwnPropertyDescriptor = (node, descriptorName, descriptorValue, {
  isFrozen,
  isSealed,
  propertyKey
}) => {
  /* eslint-disable no-unneeded-ternary */
  if (descriptorName === "writable") {
    if (isFrozen) {
      return true;
    }
    if (propertyKey === "prototype" && node.functionAnalysis.type === "class") {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  if (descriptorName === "configurable") {
    if (isFrozen) {
      return true;
    }
    if (isSealed) {
      return true;
    }
    if (propertyKey === "prototype" && node.isFunction) {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  if (descriptorName === "enumerable") {
    if (propertyKey === "prototype" && node.isFunction) {
      return descriptorValue === false;
    }
    if (propertyKey === "message" && node.isError) {
      return descriptorValue === false;
    }
    if (node.isClassPrototype) {
      return descriptorValue === false;
    }
    return descriptorValue === true;
  }
  /* eslint-enable no-unneeded-ternary */
  if (descriptorName === "get") {
    return descriptorValue === undefined;
  }
  if (descriptorName === "set") {
    return descriptorValue === undefined;
  }
  return false;
};
// const shouldIgnorePropertyDescriptor = (
//   node,
//   propertyKey,
//   descriptorKey,
//   descriptorValue,
// ) => {
//   /* eslint-disable no-unneeded-ternary */
//   if (descriptorKey === "writable") {
//     if (node.propsFrozen) {
//       return true;
//     }
//     const writableDefaultValue =
//       propertyKey === "prototype" && node.isClass ? false : true;
//     return descriptorValue === writableDefaultValue;
//   }
//   if (descriptorKey === "configurable") {
//     if (node.propsFrozen) {
//       return true;
//     }
//     if (node.propsSealed) {
//       return true;
//     }
//     const configurableDefaultValue =
//       propertyKey === "prototype" && node.isFunction ? false : true;
//     return descriptorValue === configurableDefaultValue;
//   }
//   if (descriptorKey === "enumerable") {
//     const enumerableDefaultValue =
//       (propertyKey === "prototype" && node.isFunction) ||
//       (propertyKey === "message" && node.isError) ||
//       node.isClassPrototype
//         ? false
//         : true;
//     return descriptorValue === enumerableDefaultValue;
//   }
//   /* eslint-enable no-unneeded-ternary */
//   if (descriptorKey === "get") {
//     return descriptorValue === undefined;
//   }
//   if (descriptorKey === "set") {
//     return descriptorValue === undefined;
//   }
//   return false;
// };

const createReasons = () => {
  const overall = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set()
  };
  const self = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set()
  };
  const inside = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set()
  };
  return {
    overall,
    self,
    inside
  };
};
const appendReasons = (reasonSet, ...otherReasonSets) => {
  for (const otherReasonSet of otherReasonSets) {
    for (const reason of otherReasonSet) {
      reasonSet.add(reason);
    }
  }
};
const appendReasonGroup = (reasonGroup, otherReasonGroup) => {
  appendReasons(reasonGroup.any, otherReasonGroup.any);
  appendReasons(reasonGroup.removed, otherReasonGroup.removed);
  appendReasons(reasonGroup.added, otherReasonGroup.added);
  appendReasons(reasonGroup.modified, otherReasonGroup.modified);
};
const CHAR_TO_ESCAPE = {
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  "\\": "\\\\",
  "\x00": "\\x00",
  "\x01": "\\x01",
  "\x02": "\\x02",
  "\x03": "\\x03",
  "\x04": "\\x04",
  "\x05": "\\x05",
  "\x06": "\\x06",
  "\x07": "\\x07",
  "\x0B": "\\x0B",
  "\x0E": "\\x0E",
  "\x0F": "\\x0F",
  "\x10": "\\x10",
  "\x11": "\\x11",
  "\x12": "\\x12",
  "\x13": "\\x13",
  "\x14": "\\x14",
  "\x15": "\\x15",
  "\x16": "\\x16",
  "\x17": "\\x17",
  "\x18": "\\x18",
  "\x19": "\\x19",
  "\x1A": "\\x1A",
  "\x1B": "\\x1B",
  "\x1C": "\\x1C",
  "\x1D": "\\x1D",
  "\x1E": "\\x1E",
  "\x1F": "\\x1F",
  "\x7F": "\\x7F",
  "\x83": "\\x83",
  "\x85": "\\x85",
  "\x86": "\\x86",
  "\x87": "\\x87",
  "\x88": "\\x88",
  "\x89": "\\x89",
  "\x8A": "\\x8A",
  "\x8B": "\\x8B",
  "\x8C": "\\x8C",
  "\x8D": "\\x8D",
  "\x8E": "\\x8E",
  "\x8F": "\\x8F",
  "\x90": "\\x90",
  "\x91": "\\x91",
  "\x92": "\\x92",
  "\x93": "\\x93",
  "\x94": "\\x94",
  "\x95": "\\x95",
  "\x96": "\\x96",
  "\x97": "\\x97",
  "\x98": "\\x98",
  "\x99": "\\x99",
  "\x9A": "\\x9A",
  "\x9B": "\\x9B",
  "\x9C": "\\x9C",
  "\x9D": "\\x9D",
  "\x9E": "\\x9E",
  "\x9F": "\\x9F"
};
const stringCharMappingDefault = new Map(Object.entries(CHAR_TO_ESCAPE));
const shouldDisableSeparator = (childIndex, childrenKeys, {
  hasSeparatorOnSingleChild,
  hasTrailingSeparator
}) => {
  if (childrenKeys.length === 1) {
    return !hasSeparatorOnSingleChild;
  }
  if (childIndex === childrenKeys.length - 1) {
    return !hasTrailingSeparator;
  }
  return false;
};
const canParseUrl = URL.canParse || (() => {
  try {
    // eslint-disable-next-line no-new, no-undef
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
});
const symbolToDescription = symbol => {
  const toStringResult = symbol.toString();
  const openingParenthesisIndex = toStringResult.indexOf("(");
  const closingParenthesisIndex = toStringResult.indexOf(")");
  return toStringResult.slice(openingParenthesisIndex + 1, closingParenthesisIndex);
  // return symbol.description // does not work on node
};

// const regExpSpecialCharSet = new Set([
//   "/",
//   "^",
//   "\\",
//   "[",
//   "]",
//   "(",
//   ")",
//   "{",
//   "}",
//   "?",
//   "+",
//   "*",
//   ".",
//   "|",
//   "$",
// ]);

const pickBestQuote = (string, {
  quotesBacktickDisabled
} = {}) => {
  let backslashCount = 0;
  let doubleQuoteCount = 0;
  let singleQuoteCount = 0;
  let backtickCount = 0;
  for (const char of string) {
    if (char === "\\") {
      backslashCount++;
    } else {
      if (backslashCount % 2 > 0) ; else if (char === DOUBLE_QUOTE) {
        doubleQuoteCount++;
      } else if (char === SINGLE_QUOTE) {
        singleQuoteCount++;
      } else if (char === BACKTICK) {
        backtickCount++;
      }
      backslashCount = 0;
    }
  }
  if (doubleQuoteCount === 0) {
    return DOUBLE_QUOTE;
  }
  if (singleQuoteCount === 0) {
    return SINGLE_QUOTE;
  }
  if (backtickCount === 0 && !quotesBacktickDisabled) {
    return BACKTICK;
  }
  if (singleQuoteCount > doubleQuoteCount) {
    return DOUBLE_QUOTE;
  }
  if (doubleQuoteCount > singleQuoteCount) {
    return SINGLE_QUOTE;
  }
  return DOUBLE_QUOTE;
};
const generateHeaderValueParts = (headerValue, {
  headerValueNode,
  quoteMarkerRef
}) => {
  let partIndex = 0;
  let partRaw;
  let part;
  let attribute;
  let attributeMap = null;
  let attributeNameStarted = false;
  let attributeValueStarted = false;
  let attributeName = "";
  let attributeValue = "";
  const startHeaderValuePart = () => {
    if (part) {
      part.end();
      part = null;
    }
    part = {
      end: () => {
        if (!attributeMap) {
          return;
        }
        if (attribute) {
          attribute.end();
          attribute = null;
        }
        if (attributeMap.size === 0) {
          attributeMap = null;
          part = null;
          return;
        }
        const headerValuePartNode = headerValueNode.appendChild(partIndex, {
          group: "entries",
          subgroup: "header_part",
          value: partRaw,
          render: renderChildren,
          onelineDiff: {},
          startMarker: partIndex === 0 ? "" : ",",
          path: headerValueNode.path.append(partIndex, {
            isIndexedEntry: true
          })
        });
        let isFirstAttribute = true;
        for (const [attributeName, attributeValue] of attributeMap) {
          const attributeNameNormalized = attributeName.trim();
          const headerAttributeNode = headerValuePartNode.appendChild(attributeNameNormalized, {
            group: "entry",
            subgroup: "header_attribute",
            render: renderChildren,
            onelineDiff: {},
            path: headerValuePartNode.path.append(attributeNameNormalized)
          });
          if (attributeValue === true) {
            headerAttributeNode.appendChild("entry_key", {
              subgroup: "header_attribute_name",
              value: attributeName,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef,
              startMarker: isFirstAttribute ? "" : ";"
            });
          } else {
            headerAttributeNode.appendChild("entry_key", {
              subgroup: "header_attribute_name",
              value: attributeName,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef,
              startMarker: isFirstAttribute ? "" : ";",
              endMarker: "="
            });
            headerAttributeNode.appendChild("entry_value", {
              subgroup: "header_attribute_value",
              key: attributeName,
              value: attributeValue,
              render: renderString,
              stringDiffPrecision: "none",
              quotesDisabled: true,
              quoteMarkerRef
            });
          }
          isFirstAttribute = false;
        }
        partIndex++;
        attributeMap = null;
        part = null;
      }
    };
    partRaw = "";
    attributeMap = new Map();
    startAttributeName();
  };
  const startAttributeName = () => {
    if (attribute) {
      attribute.end();
      attribute = null;
    }
    attributeNameStarted = true;
    attribute = {
      end: () => {
        if (!attributeNameStarted && !attributeValueStarted) {
          return;
        }
        if (!attributeValue) {
          if (!attributeName) {
            // trailing ";" (or trailing ",")
            attributeNameStarted = false;
            return;
          }
          attributeMap.set(attributeName, true);
          attributeNameStarted = false;
          attributeName = "";
          attributeValueStarted = false;
          return;
        }
        attributeMap.set(attributeName, attributeValue);
        attributeNameStarted = false;
        attributeName = "";
        attributeValueStarted = false;
        attributeValue = "";
      }
    };
  };
  const startAttributeValue = () => {
    attributeNameStarted = false;
    attributeValueStarted = true;
  };
  startHeaderValuePart();
  let charIndex = 0;
  while (charIndex < headerValue.length) {
    const char = headerValue[charIndex];
    partRaw += char;
    if (char === ",") {
      startHeaderValuePart();
      charIndex++;
      continue;
    }
    if (char === ";") {
      startAttributeName();
      charIndex++;
      continue;
    }
    if (char === "=") {
      startAttributeValue();
      charIndex++;
      continue;
    }
    if (attributeValueStarted) {
      attributeValue += char;
      charIndex++;
      continue;
    }
    if (attributeNameStarted) {
      attributeName += char;
      charIndex++;
      continue;
    }
    throw new Error("wtf");
  }
  part.end();
};

export { assert };
