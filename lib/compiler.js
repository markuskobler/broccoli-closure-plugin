const fs      = require('fs')
const path    = require('path')
const mkdirp  = require('mkdirp')
const Promise = require('rsvp').Promise
const {
  compile,
  logger
} = require('google-closure-compiler-js');

// TODO
// - Externs support
// - Should bubble up compiler std(out|err) events?
// - Document...
function Compiler(options) {
  if (!(this instanceof Compiler)) {
    return function Compiler_compile(cwd, inputs, output, options) {
      return _compile(cwd, inputs, output, options)
    }.apply(this, arguments);
  }

  this._options = options;
}
module.exports = Compiler;

Compiler.prototype.compile = function(cwd, inputs, output) {
  return _compile(cwd, inputs, output, this._options)
}

function _compile(cwd, files, destFile, options) {

  // var debug = !!_take(options, 'debug')
  // if (debug) {
  //   args.push('--debug')
  // }

  delete options['debug'];
  //delete options['formatting'];
  //delete options['jscompWarning'];

  const opts = {};
  for (const k in options) {
    opts[_cleanOptionsKey(k)] = options[k];
  }
  opts.jsCode = files.map(file => {
    return {
      path: file,
      src: fs.readFileSync(path.join(cwd, file), {encoding: 'UTF8'})
//      src: file.contents.toString(),
    };
  });

  return new Promise(function(resolve, reject) {
    mkdirp(path.dirname(destFile), function(err) {
      if (err) {
        return reject(err)
      }

      const output = compile(opts);

      if (logger(options, output, console.log)) {
        reject(new Error(`Compilation error, ${output.errors.length} errors`));
      } else {
        fs.writeFile(destFile, output.compiledCode, 'utf8', resolve)
      }
    })
  })
}

function _take(opts, arg) {
  var value = opts[arg];
  delete opts[arg];
  return value;
}

function _processArgs(args, opts) {
  var i, j, key, value, keys = Object.keys(opts);
  for (i=0; i < keys.length; i++) {
    key = keys[i];
    value = opts[key];
    if (value === false) {
      /* ignore */
    } else if (value === true || value === void 0) {
      args.push('--'+key)
    } else if (Array.isArray(value)) {
      for (j=0; j < value.length; j++) {
        args.push('--'+key, value[j])
      }
    } else {
      args.push('--'+key, value)
    }
  }
  return args
}

function _cleanOptionsKey(key) {
  // replace "_foo" with "Foo"
  key = key.replace(/_(\w)/g, match => match[1].toUpperCase());

  // remove leading dashes
  key = key.replace(/^--/, '');

  return key;
}
