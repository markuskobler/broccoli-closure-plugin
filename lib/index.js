var CachingWriter = require('broccoli-caching-writer')
var rsvp     = require('rsvp')
var Promise  = rsvp.Promise
var glob     = rsvp.denodeify(require("glob"))
var path     = require('path')
var compiler = require('./compiler')

function ClosureCompiler(inputTree, output, opts) {
  if (!(this instanceof ClosureCompiler)) return new ClosureCompiler(inputTree, output, opts);
  if (!Array.isArray(inputTree)) {
    inputTree = [inputTree]
  } else if (inputTree.length > 1) {
    throw new Error('You passed an array of input trees, but only a single tree is allowed.');
  }
  if (!output) throw new Error('Missing output path');

  this._include = opts.include || '**/*.js';
  this._exclude = opts.exclude;
  delete opts.include
  delete opts.exclude

  CachingWriter.call(this, inputTree);

  opts = opts || {}

  this._opts = opts;
  this._output = output;
}
ClosureCompiler.prototype = Object.create(CachingWriter.prototype)
ClosureCompiler.prototype.constructor = ClosureCompiler

ClosureCompiler.prototype.updateCache = function(srcDir, destDir) {
  var cwd = srcDir.pop();
  return glob(this._include, {cwd: cwd, ignore: this._exclude}).then(function(files) {
    var destFile = path.join(destDir, this._output)

    if (files.length === 0) {
      throw new Error("No files found")
    }

    return compiler(cwd, files, destFile, this._opts).then(function(warnings) {
      if (warnings && warnings.length > 0) {
        console.log(warnings)
      }
    })
  }.bind(this))
}
module.exports = ClosureCompiler;

