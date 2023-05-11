import { createHash } from "node:crypto";

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
// https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
export const createVersionGenerator = () => {
  const hash = createHash("sha256");

  return {
    augmentWithContent: (content) => {
      hash.update(content);
    },
    augment: (value) => {
      hash.update(value);
    },
    generate: () => {
      return hash.digest("hex").slice(0, 8);
    },
  };
};
