import { uneval } from "@dmail/uneval"

export const convertFunctionAndArgumentsToSource = (fn, args) => {
  const fnSource = `(${uneval(fn)})`
  const argumentsSource = args.map((value) => uneval(value))

  return `(${fnSource})(${argumentsSource.join(",")})`
}
