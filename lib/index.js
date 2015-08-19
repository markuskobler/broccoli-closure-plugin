var CachingWriter = require('broccoli-caching-writer')
var mkdirp        = require('mkdirp').sync;
var path          = require('path')
var fs            = require('fs')
var copyDereference = require('copy-dereference').sync
var compiler      = require('./compiler')

function ClosureCompiler(inputTree, output, opts) {
  if (!(this instanceof ClosureCompiler))
    return new ClosureCompiler(inputTree, output, opts);

  if (!output)
    throw new Error('Missing output path');

  // TODO implement merge trees?
  this.enforceSingleInputTree = true;

  opts = opts || {}

  CachingWriter.call(this, inputTree, {
    filterFromCache: {
      include: opts.include || [/\.js$/],
      exclude: opts.exclude || [],
    }
  })
  this._opts = opts;
  this._output = output;
}
ClosureCompiler.prototype = Object.create(CachingWriter.prototype)
ClosureCompiler.prototype.constructor = ClosureCompiler

ClosureCompiler.prototype.updateCache = function(cwd, destDir) {
  var destFile = path.join(destDir, this._output)

  var files = this.listFiles().map(function(path) {
    return path.slice(cwd.length+1)
  })

  files = _sortJS(files, this._opts.prefix, this._opts.suffix);

  if (files.length === 0)
    throw new Error("No files found")

  var sourcemap
  var opts = _filterOpts(this._opts);
  if (this._opts.sourcemaps) {
    sourcemap = destFile+".map"
    opts.create_source_map = sourcemap
    opts.source_map_location_mapping = files.map(function(f) {
      return f+"|/+/"+f
    })
  }

  if (this._opts.externs) {
    if (Array.isArray(this._opts.externs)) {
      opts.externs = this._opts.externs.reduce(convertExtern, [])
    } else {
      opts.externs = convertExtern([], this._opts.externs)
    }

    function convertExtern(result, extern) {
      if (!path.isAbsolute(extern)) {
        extern = path.join(process.cwd(), extern);
      }
      try {
        var stats = fs.statSync(extern);

        if (stats.isDirectory()) {
          try {
            return fs.readdirSync(extern).reduce(function(result, file) {
              if (path.extname(file) === ".js") {
                result.push(path.join(extern, file))
              }
              return result
            }, result)
          } catch (err) {
            console.warn('Warning: failed read directory ' + extern);
          }
        } else {
          result.push(extern)
        }

      } catch (err) {
        console.warn('Warning: failed to stat ' + exter);
      }

      return result
    }
  }

  return compiler(cwd, files, destFile, opts).then(function(warnings) {
    if (warnings && warnings.length > 0) {
      console.log(warnings)
    }
    if (sourcemap) {
      fs.appendFileSync(destFile, "//# sourceMappingURL="+path.basename(sourcemap))
      files.map(function(f) {
        var out = path.join(destDir, '+', f)
        mkdirp(path.dirname(out))
        copyDereference(path.join(cwd, f), out)
      })
    }
  })
}
module.exports = ClosureCompiler;

var ignoreOpts = {
  include:   true,
  exclude:   true,
  prefix:    true,
  suffix:    true,
  sourcemap: true,
  externs:   true
}

function _filterOpts(opts) {
  var opt, o = {}
  for (opt in opts)
    if (opt in opts && !(opt in ignoreOpts))
      o[opt] = opts[opt]
  return o
}

function _sortJS(files, prefix, suffix) {
  var ignore;
  if (prefix) {
    prefix = Array.isArray(prefix) ? prefix.slice(0) : [prefix]
    ignore = ignoreFiles(prefix)
  }
  if (suffix) {
    suffix = Array.isArray(suffix) ? suffix.slice(0) : [suffix]
    ignore = ignoreFiles(suffix, ignore)
  }
  if (ignore) {
    return files.reduce(function(m, v) {
      if (!(v in ignore)) m.push(v)
      return m
    }, prefix || []).concat(suffix)
  }
  return files

  function ignoreFiles(files, m) {
    return files.reduce(function(m, v) {
      m[v] = true;
      return m
    }, m || {})
  }
}
