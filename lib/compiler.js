var fs      = require('fs')
var path    = require('path')
var mkdirp  = require('mkdirp')
var spawn   = require('child_process').spawn
var Promise = require('rsvp').Promise

//Compiler.OPTIONS   = {}
Compiler.JAR_PATH  = path.join(__dirname, '..', 'vendor', 'closure-compiler-v20161201.jar')
Compiler.JAVA_PATH = _javaPath()
Compiler.JAVA_ARGS = ['-server', '-XX:+TieredCompilation']

// TODO
// - Externs support
// - Should bubble up compiler std(out|err) events?
// - Document...
function Compiler(options) {
  if (!(this instanceof Compiler)) {
    return function Compiler_compile(cwd, inputs, output, options) {
      return _compile(cwd, inputs, output, _processOpts(Compiler, options))
    }.apply(this, arguments);
  }

  this._options = options;
}
module.exports = Compiler;

Compiler.prototype.compile = function(cwd, inputs, output) {
  return _compile(cwd, inputs, output, _processOpts(this, this._options))
}

function _compile(cwd, files, destFile, options) {
  var java = _take(options, 'java')
  var args = Compiler.JAVA_ARGS.slice(0)

  args.push('-jar', _take(options, 'jar'))

  var debug = !!_take(options, 'debug')
  if (debug) {
    args.push('--debug')
  }

  delete options.js_output_file
  args.push('--js_output_file', destFile)

  args = _processArgs(args, options)

  if (Array.isArray(files)) {
    args = args.concat(files)
  } else {
    args.push(files)
  }

  if (debug) {
    console.log( " pwd:", cwd );
    console.log( "args: java " + args.join(' '));
  }

  return new Promise(function(resolve, reject) {
    mkdirp(path.dirname(destFile), function(err) {
      if (err) {
        return reject(err)
      }
      var process = spawn(java, args, { cwd: cwd, stdio: ['ignore', 'pipe', 'pipe'] })
      var out = [];
      process.stdout.on('data', out.push.bind(out))
      process.stderr.on('data', out.push.bind(out))
      process.on('exit', function onJavaExec(code) {
        var output = Buffer.concat(out).toString('utf8');
        if (code === 0) {
          resolve(output)
        } else {
          var err = new Error(output)
          err.code = code
          reject(err);
        }
      })
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

function _processOpts(self, options) {
  var opts = options || {}
  opts.jar  = self.JAR_PATH
  opts.java = self.JAVA_PATH
  return opts;
}

function _javaPath() {
  var javaHome = process.env['JAVA_HOME']
  if (javaHome) {
    java = path.join(javaHome, 'bin', process.platform == 'win32' ? 'java.exe' : 'java')
    if (!fs.existsSync(java)) {
      return java
    }
  }
  return 'java';
}
