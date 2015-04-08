# broccoli-closure

A [closure compiler](https://github.com/google/closure-compiler) plugin for [broccoli](https://github.com/joliss/broccoli).

## Install

```sh
$ npm install --save broccoli-closure
```

## Usage

```js
var compile = require('broccoli-closure');

var outputTree = compile(inputTree, outputFile, options);
```

* **`inputTree`**: A single path or tree of JavaScript files to compile.

* **`outputFile`**: Relative path of the output CSS file.

* **`options`**: A hash of options for closure compiler.


## Example

```js
var closure = require('broccoli-closure');

var js =  closure('js', 'app.js', {
  'language_in':         'ECMASCRIPT6',
  'language_out':        'ECMASCRIPT5',
  'warning_level':       'verbose',
  'jscomp_warning':      ['undefinedVars', 'checkRegExp', 'const', 'constantProperty', 'accessControls'],
  'output_wrapper':      '(function(){%output%})()',
  'compilation_level':   'ADVANCED'
})
```
