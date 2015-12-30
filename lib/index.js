var CachingWriter = require('broccoli-caching-writer');
var mkdirp        = require('mkdirp').sync;
var path          = require('path');
var fs            = require('fs');
var copyDereference = require('copy-dereference').sync;
var compiler      = require('./compiler');
var ES6Imports    = require('./es6imports');

function ClosureCompiler(inputTrees, entrypoints, output, opts) {
  if (!(this instanceof ClosureCompiler))
    return new ClosureCompiler(inputTrees, entrypoints, output, opts);

  if (!output)
    throw new Error('Missing output path');

  opts = opts || {};

  CachingWriter.call(this, inputTrees, {
    cacheInclude: opts.include || [/\.js$/],
    cacheExclude: opts.exclude || []
  });
  this._opts = opts;
  this._entrypoints = entrypoints;
  this._output = output;

  this._files = {};
  this._updated = false;
}
ClosureCompiler.prototype = Object.create(CachingWriter.prototype);
ClosureCompiler.prototype.constructor = ClosureCompiler;

ClosureCompiler.prototype.build = function() {
  var destFile = path.join(this.cachePath, this._output);

  var files = this.listSortedFiles(this._entrypoints);

  if (files.length === 0)
    throw new Error("No files found");

  if (!this._updated) {
    var out = path.join(this.outputPath, this._output);
    mkdirp(path.dirname(out));
    copyDereference(destFile, out);
    return;
  }

  var sourcemap;
  var opts = _filterOpts(this._opts);

  if (this._opts.sourcemaps) {
    // TODO handle incoming sourcemaps?
    sourcemap = destFile + ".map";
    opts.create_source_map = sourcemap;
    opts.source_map_location_mapping = files.map(function(f) {
      return f + "|/+/" + f;
    });
  }

  if (this._opts.externs) {
    if (Array.isArray(this._opts.externs)) {
      opts.externs = this._opts.externs.reduce(convertExtern, []);
    } else {
      opts.externs = convertExtern([], this._opts.externs);
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
                result.push(path.join(extern, file));
              }
              return result;
            }, result);
          } catch (err) {
            console.warn('Warning: failed read directory ' + extern);
          }
        } else {
          result.push(extern);
        }

      } catch (err) {
        console.warn('Warning: failed to stat ' + exter);
      }

      return result;
    }
  }

  // TODO fix me
  var rootPath = this.inputPaths[0];

  return compiler(rootPath, files, destFile, opts).then(function(warnings) {
    if (warnings && warnings.length > 0) {
      console.log(warnings);
    }

    // if (sourcemap) {
    //   fs.appendFileSync(destFile, "//# sourceMappingURL=" + path.basename(sourcemap));
    //   files.map(function(f) {
    //     var out = path.join(this.outputPath, '+', f);
    //     mkdirp(path.dirname(out));
    //     copyDereference(path.join(this.cachePath, f), out);
    //   });
    // }

    var out = path.join(this.outputPath, this._output);
    mkdirp(path.dirname(out));
    copyDereference(destFile, out);

  }.bind(this));
};
module.exports = ClosureCompiler;


ClosureCompiler.prototype.listSortedFiles = function(entrypoints) {
  var basePath = "";
  var files = {};
  var moveFiles = false;

  var entries = this.listEntries();

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];

    if (!files[entry.relativePath]) {
      files[entry.relativePath] = entry;

      if (!moveFiles) {
        if (basePath === "") {
          basePath = entry.basePath;
        } else if (basePath !== entry.basePath) {
          moveFiles = true;
          basePath = this.cachePath;
        }
      }
    }
  }

  if (moveFiles) {
    console.log( "Move files?" );
    // TODO:
  }

  return this.parseModules(files, entrypoints, this._files);
};

ClosureCompiler.prototype.parseModules = function(files, entrypoints, tree) {
  var deps = [];
  this._updated = false;

  if (!Array.isArray(entrypoints)) {
    entrypoints = [entrypoints];
  }

  for (var i = 0; i < entrypoints.length; i++) {
    var e = files[path.normalize(entrypoints[i])];
    if (!e) {
      throw new Error("Not Found: `" + entrypoints[i] + "`");
    }
    this._updated = this._updated | parseModuleBody(files, tree, e, deps);
  }

  return deps;
};


function parseModuleBody(files, tree, entry, deps) {
  var fullPath = path.join(entry.basePath, entry.relativePath);
  var updated = false;

  var requires;
  var current = tree[entry.relativePath];

  if (current && current.basePath == entry.basePath && current.mtime == entry.mtime && current.size == entry.size ) {
    requires = current.requires;
  } else {
    updated = true;

    requires = ES6Imports.parseModules(fs.readFileSync(fullPath));

    for (var i = 0; i < requires.length; i++) {
      var r = requires[i];
      if (path.extname(r).length === 0) {
        r += ".js";
      }

      if (r.startsWith("/")) {
        r = r.substring(1);
      } else if ( r.startsWith(".") ) {
        r = path.join(path.dirname(entry.relativePath), r);
      }

      requires[i] = r;
    }

    current = tree[entry.relativePath] = {
      basePath: entry.basePath,
      mtime: entry.mtime,
      size: entry.size,
      requires: requires
    };
  }

  for (var i = 0; i < requires.length; i++) {
    var r = requires[i];
    var e = files[r];
    if (!e) {
      throw new Error("dependency `" + r + "` not found in `" + entry.relativePath + "` " + requires[i]);
    }

    updated = updated | parseModuleBody(files, tree, e, deps);
  }

  deps.push(entry.relativePath);

  return updated;
}

var ignoreOpts = {
  include:   true,
  exclude:   true,
  prefix:    true,
  suffix:    true,
  sourcemap: true,
  externs:   true
};

function _filterOpts(opts) {
  var opt, o = {};
  for (opt in opts)
    if (opt in opts && !(opt in ignoreOpts))
      o[opt] = opts[opt];
  return o;
}

function _sortJS(files, prefix, suffix) {
  var ignore;
  if (prefix) {
    prefix = Array.isArray(prefix) ? prefix.slice(0) : [prefix];
    ignore = ignoreFiles(prefix);
  }
  if (suffix) {
    suffix = Array.isArray(suffix) ? suffix.slice(0) : [suffix];
    ignore = ignoreFiles(suffix, ignore);
  }
  if (ignore) {
    return files.reduce(function(m, v) {
      if (!(v in ignore)) m.push(v);
      return m;
    }, prefix || []).concat(suffix);
  }
  return files;

  function ignoreFiles(files, m) {
    return files.reduce(function(m, v) {
      m[v] = true;
      return m;
    }, m || {});
  }
}
