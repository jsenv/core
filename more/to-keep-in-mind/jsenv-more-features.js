function validDomCollectionIteration() {
    return function() {
        return false;
    };
    // return function(domCollection) {
    //     if (jsenv.isBrowser()) {
    //         return combine(
    //             method(domCollection),
    //             method(domCollection + '.keys'),
    //             method(domCollection + '.values'),
    //             method(domCollection + '.entries'),
    //             method(domCollection + '[Symbol.iterator]')
    //         ).valid;
    //     }
    //     return false;
    // };
}
if (jsenv.isBrowser()) {
    registerStandardFeatures('global',
        {
            name: 'node-list-iteration',
            path: 'NodeList',
            valid: validDomCollectionIteration()
        },
        {
            name: 'dom-token-list-iteration',
            path: 'DOMTokenList',
            valid: validDomCollectionIteration()
        },
        {
            name: 'media-list-iteration',
            path: 'MediaList',
            valid: validDomCollectionIteration()
        },
        {
            name: 'style-sheet-list-iteration',
            path: 'StyleSheetList',
            valid: validDomCollectionIteration()
        },
        {
            name: 'css-rule-list-iteration',
            path: 'CSSRuleList',
            valid: validDomCollectionIteration()
        }
    );
}

registerStandardFeatures('math',
    {name: 'acosh'},
    {name: 'asinh'},
    {name: 'atanh'},
    {name: 'cbrt'},
    {name: 'clamp', spec: 'es7'},
    {name: 'clz32'},
    {name: 'cosh'},
    {name: 'deg-per-rad', path: 'Math.DEG_PER_RAD', spec: 'es7'},
    {name: 'degrees', spec: 'es7'},
    {name: 'expm1'},
    {name: 'fround'},
    {name: 'fscale', spec: 'es7'},
    {name: 'hypot'},
    {name: 'iaddh', spec: 'es7'},
    {name: 'imul'},
    {name: 'imulh', spec: 'es7'},
    {name: 'isubh', spec: 'es7'},
    {name: 'log10'},
    {name: 'log1p'},
    {name: 'log2'},
    {name: 'radians', spec: 'es7'},
    {name: 'rad-per-deg', path: 'Math.RAD_PER_DEG', spec: 'es7'},
    {name: 'scale', spec: 'es7'},
    {name: 'sign'},
    {name: 'sinh'},
    {name: 'tanh'},
    {name: 'trunc'},
    {name: 'umulh', spec: 'es7'}
);

registerStandardFeatures('reflect',
    {name: 'apply'},
    {name: 'construct'},
    {name: 'define-property'},
    {name: 'delete-property'},
    {name: 'enumerate'},
    {name: 'get'},
    {name: 'get-own-property-descriptor'},
    {name: 'get-prototype-of'},
    {name: 'has'},
    {name: 'own-keys'},
    {name: 'prevent-extensions'},
    {name: 'set'},
    {name: 'set-prototype-of'},

    {name: 'define-metadata', spec: 'es7'},
    {name: 'delete-metadata', spec: 'es7'},
    {name: 'get-metadata', spec: 'es7'},
    {name: 'get-metadata-keys', spec: 'es7'},
    {name: 'get-own-metadata', spec: 'es7'},
    {name: 'get-own-metadata-keys', spec: 'es7'},
    {name: 'has-metadata', spec: 'es7'},
    {name: 'has-own-metadata', spec: 'es7'},
    {name: 'metadata', spec: 'es7'}
);
