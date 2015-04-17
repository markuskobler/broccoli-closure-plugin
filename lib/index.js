var CachingWriter = require('broccoli-caching-writer')
var rsvp          = require('rsvp')
var Promise       = rsvp.Promise
var mkdirp        = require('mkdirp').sync;
var symlinkOrCopy = require('symlink-or-copy').sync;
var path          = require('path')
var fs            = require('fs')
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

  return compiler(cwd, files, destFile, _filterOpts(this._opts)).then(function(warnings) {
    if (warnings && warnings.length > 0) {
      console.log(warnings)
    }
  })
}
module.exports = ClosureCompiler;

var ignoreOpts = {
  include: true,
  exclude: true,
  prefix:  true,
  suffix:  true
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
