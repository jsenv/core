var id = 0
export default function(name) {
  // eslint-disable-next-line prefer-template
  return "__private_" + id++ + "_" + name
}
