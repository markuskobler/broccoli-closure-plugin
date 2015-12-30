var path   = require('path');
var fs     = require('fs');
var espree = require('espree');
var rsvp   = require('rsvp');
var visit  = require('ast-types').visit;


ES6Imports.parseModules = function(source) {
  var deps = [];

  visit( espree.parse( source, { sourceType: 'module' }), {
    visitImportDeclaration: function(p) {
      deps.push( p.node.source.value );
      return false;
    },
    visitExportAllDeclaration: function(p) {
      var source = p.value.source;
      if (source) {
        deps.push( source.value );
      }
      return false;
    },
    visitExportNamedDeclaration: function(p) {
      var source = p.value.source;
      if (source) {
        deps.push( source.value );
      }
      return false;
    }
  });

  return deps;
};


function ES6Imports() {}
module.exports = ES6Imports;
