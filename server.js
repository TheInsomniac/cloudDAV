"use strict";

var jsDAV = require("jsDAV/lib/jsdav"),
    jsDAV_Auth_Backend_File = require("jsDAV/lib/DAV/plugins/auth/file"),
    jsDAV_Locks_Backend_FS = require("jsDAV/lib/DAV/plugins/locks/fs"),
    jsDAV_Util = require("jsDAV/lib/shared/util"),
    fs = require("fs");

/* Disable jsDAV debugMode. Enabling this displays A LOT of information */
jsDAV.debugMode = false;

/* Directory to serve via webdav */
var serveDir = __dirname + "/node_modules/jsDAV/test/assets";
/*  Path to htdigest file. Ensure no new lines in this file as it is likely
    to choke jsDAV */
var htdigest = __dirname + "/.htdigest";
/* The realm to use for authentication against htdigest */
var realm = "webdav";
/* IP Address to bind to */
var ip = "127.0.0.1";
/* Port to bind to */
var port = 8000;

/*
    Obtain a list of the available plugins throwing away "browser.js"
    which we'll implement ourselves in "cloudBrowser.js"
*/
var plugins = {};
fs.readdirSync(__dirname + "/node_modules/jsDAV/lib/DAV/plugins").forEach(function(filename){
  if (/\.js$/.test(filename)) {
    var name = filename.substr(0, filename.lastIndexOf("."));
    var pluginCls = require(__dirname + "/node_modules/jsDAV/lib/DAV/plugins/" + name);
    if (name !== "browser") plugins[pluginCls.name || name] = pluginCls;
  }
});

/*
    Start the server locking the user into the directory specified in "serveDir"
    Load our plugin list from below then extend the Object with our own client
    frontend "cloudBrowser"
*/
jsDAV.createServer({
  node: serveDir,
  locksBackend: jsDAV_Locks_Backend_FS.new(serveDir),
  plugins: jsDAV_Util.extend(plugins, {
    cloudBrowser: require(__dirname + "/lib/cloudBrowser")
  }),
  authBackend: jsDAV_Auth_Backend_File.new(htdigest),
  realm: realm
}, port, ip);
