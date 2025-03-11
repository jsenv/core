export default (source, excluded) => {
  if (source === null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key;
  var i;
  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.includes(key)) continue;
    target[key] = source[key];
  }
  return target;
};
