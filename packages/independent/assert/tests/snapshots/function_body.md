# arrow function containing arrow function

```js
generateFunctionBody(() => {
  const a = () => {};
  a();
});
```

![img](<./function_body/arrow function containing arrow function.svg>)

# anonymous arrow default param arrow

```js
generateFunctionBody((a = () => {}) => {
  return a;
});
```

![img](<./function_body/anonymous arrow default param arrow.svg>)

# anonymous arrow returning string

```js
generateFunctionBody(() => {
  return "yo";
});
```

![img](<./function_body/anonymous arrow returning string.svg>)

# anonymous arrow one liner object notation

```js
generateFunctionBody(() => ({}));
```

![img](<./function_body/anonymous arrow one liner object notation.svg>)

# anonymous function returning a + b

```js
generateFunctionBody(function (a, b) {
  return a + b;
});
```

![img](<./function_body/anonymous function returning a + b.svg>)

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

![img](<./function_body/named arrow function.svg>)

# named function returning a + b

```js
generateFunctionBody(
  // prettier-ignore
  function name  ( a,  b )   {
    return a + b;
  },
);
```

![img](<./function_body/named function returning a + b.svg>)

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

![img](<./function_body/getter returning 10.svg>)

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

![img](<./function_body/setter incrementing value.svg>)

