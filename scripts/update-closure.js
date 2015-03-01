#!/usr/bin/env node

// TODO: add proxy support?
// TODO: improve errors reporting

var http = require('http');
var zlib = require('zlib');
var fs   = require('fs');
var join = require('path').join;
var tar  = require('tar');

var etag, etagPath = join('vendor', '.etag');

try {
  etag = fs.readFileSync(etagPath)
} catch(err) {
  // ignore
}

downloadCompiler('vendor', etag, function(err, etag) {
  if (err) {
    console.log( 'Downloading closure compiler - Failed', err)
  } else if (etag) {
    console.log( 'Downloading closure compiler - Updated' );
    fs.writeFileSync(etagPath, etag)
  } else {
    console.log( 'Downloading closure compiler - Not Modified' );
  }
})

function downloadCompiler(out, etag, callback) {
  var req = http.request({
    method: 'GET',
    path: '/closure-compiler/compiler-latest.tar.gz',
    hostname: 'dl.google.com',
    headers: etag ? {'If-None-Match': etag} : {}
  });
  req.end();
  console.log( 'Downloading closure compiler' );

  req.on('response', function(resp) {
    if (resp.statusCode === 304) {
      resp.read();
      callback();
      return
    }
    resp.on('error', function(err) { callback(err) })

    var gunzip = resp.pipe(zlib.createGunzip());
    gunzip.on('error', function(err) { callback(err) })

    var untar = tar.Extract({ path: out })
    untar.on('error', function(err) { callback(err) })

    gunzip.pipe(untar)

    resp.on('end', function() {
      callback(null, resp.headers.etag)
    })
  })

}
