# arrow function containing arrow function

```js
generateFunctionBody(() => {
  const a = () => {};
  a();
});
```

![img](<./function_body/arrow_function_containing_arrow_function.svg>)

# anonymous arrow default param arrow

```js
generateFunctionBody((a = () => {}) => {
  return a;
});
```

![img](<./function_body/anonymous_arrow_default_param_arrow.svg>)

# anonymous arrow returning string

```js
generateFunctionBody(() => {
  return "yo";
});
```

![img](<./function_body/anonymous_arrow_returning_string.svg>)

# anonymous arrow one liner object notation

```js
generateFunctionBody(() => ({}));
```

![img](<./function_body/anonymous_arrow_one_liner_object_notation.svg>)

# anonymous function returning a + b

```js
generateFunctionBody(function (a, b) {
  return a + b;
});
```

![img](<./function_body/anonymous_function_returning_a_+_b.svg>)

# named arrow function

```js
generateFunctionBody(
  {
    a: () => {
      console.log(10);
    },
  }.a,
);
```

![img](<./function_body/named_arrow_function.svg>)

# named function returning a + b

```js
generateFunctionBody(
  // prettier-ignore
  function name  ( a,  b )   {
    return a + b;
  },
);
```

![img](<./function_body/named_function_returning_a_+_b.svg>)

# getter returning 10

```js
generateFunctionBody(
  Object.getOwnPropertyDescriptor(
    {
      // prettier-ignore
      get   a()  {
        return 10;
      },
    },
    "a",
  ).get,
);
```

![img](<./function_body/getter_returning_10.svg>)

# setter incrementing value

```js
generateFunctionBody(
  Object.getOwnPropertyDescriptor(
    {
      /* eslint-disable accessor-pairs */
      // prettier-ignore
      set   name ( value )  {
        value++
        
      },
      /* eslint-enable accessor-pairs */
    },
    "name",
  ).set,
);
```

![img](<./function_body/setter_incrementing_value.svg>)

