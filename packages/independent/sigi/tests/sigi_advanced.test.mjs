/*
 * - prevent extensions
 * - ne pas mettre de placeholder lorsque preventExtensions se produit
 * - tester qu'on a pas besoin de repréciser preventExtension a mutate
 *   de sorte que le state initial sers de modele et mutate ne peut
 *   pas rerender le state extensible
 */

import { assert } from "@jsenv/assert";
import { sigi } from "@jsenv/sigi";

// warning when on get property that does not exists + state is not extensible
{
  const { state } = sigi(Object.preventExtensions({ foo: true }));
  const consoleWarnings = [];
  const { warn } = console;
  console.warn = (warning) => {
    consoleWarnings.push(warning);
  };
  try {
    // eslint-disable-next-line no-unused-expressions
    state.bar;
    const actual = consoleWarnings;
    const expect = [
      `no property named "bar" exists on state and state is not extensible`,
    ];
    assert({ actual, expect });
  } finally {
    console.warn = warn;
  }
}

// preventExtensions is respected
{
  const { mutate } = sigi(
    Object.preventExtensions({
      nested: Object.preventExtensions({ foo: true }),
    }),
  );
  try {
    mutate({ nested: { foo: true, bar: true } });
    throw new Error("should throw");
  } catch (e) {
    const actual = e;
    const expect = new Error(
      `Cannot add property "bar", state is not extensible`,
    );
    assert({ actual, expect });
  }
}

// in operator
{
  const { state } = sigi({ foo: true });
  const foo = "foo" in state;
  const bar = "bar" in state;
  const actual = { foo, bar };
  const expect = { foo: true, bar: false };
  assert({ actual, expect });
}

// Object.getOwnPropertyDescriptor
{
  const { state } = sigi({ foo: true });
  const fooDescriptor = Object.getOwnPropertyDescriptor(state, "foo");
  const barDescriptor = Object.getOwnPropertyDescriptor(state, "bar");
  const actual = {
    fooDescriptor,
    barDescriptor,
  };
  const expect = {
    fooDescriptor: {
      value: true,
      writable: true,
      enumerable: true,
      configurable: true,
    },
    barDescriptor: undefined,
  };
  assert({ actual, expect });
}

// Object.hasOwn
{
  const { state } = sigi({ foo: true });
  const foo = Object.hasOwn(state, "foo");
  const bar = Object.hasOwn(state, "bar");
  const actual = { foo, bar };
  const expect = { foo: true, bar: false };
  assert({ actual, expect });
}

// Object.isExtensible
{
  const extensible = sigi({});
  const nonExtensible = sigi(Object.preventExtensions({}));
  const actual = {
    extensible: Object.isExtensible(extensible.state),
    nonExtensible: Object.isExtensible(nonExtensible.state),
  };
  const expect = {
    extensible: true,
    nonExtensible: false,
  };
  assert({ actual, expect });
}

// Object.create(null)
{
  const { state } = sigi(Object.create(null));
  const actual = Object.getPrototypeOf(state);
  const expect = null;
  assert({ actual, expect });
}

// throw if initial state is not configurable
{
  const stateObject = {};
  Object.defineProperty(stateObject, "foo", {
    value: true,
    configurable: false,
    enumerable: true,
  });
  try {
    sigi(stateObject);
    throw new Error("should throw");
  } catch (e) {
    const actual = e;
    const expect = new Error(`Cannot set "foo", property must be configurable`);
    assert({ actual, expect });
  }
}

// warning when mutate changes the type
{
  const consoleWarnings = [];
  const { warn } = console;
  console.warn = (warning) => {
    consoleWarnings.push(warning);
  };
  try {
    const { mutate } = sigi({ isLogged: true }, { strict: true });
    mutate({ isLogged: 1 });
    const actual = consoleWarnings;
    const expect = [
      `A value type will change from "boolean" to "number" at state.isLogged`,
    ];
    assert({ actual, expect });
  } finally {
    console.warn = warn;
  }
}
