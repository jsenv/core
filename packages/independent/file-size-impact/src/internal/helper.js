// https://gist.github.com/borekb/f83e48479aceaafa43108e021600f7e3
export const anchor = (text, id) => {
  return `<a href="#user-content-${id.replace()}">${text}<a>`;
};

export const isAdded = ({ beforeMerge }) => !beforeMerge;

export const isDeleted = ({ beforeMerge, afterMerge }) =>
  beforeMerge && !afterMerge;

export const isModified = ({ beforeMerge, afterMerge }) =>
  beforeMerge && afterMerge && beforeMerge.hash !== afterMerge.hash;
