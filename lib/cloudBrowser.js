/*
 * @package jsDAV
 * @subpackage DAV
 */
"use strict";

var jsDAV_ServerPlugin = require("jsDAV/lib/DAV/plugin");
var jsDAV_iFile = require("jsDAV/lib/DAV/interfaces/iFile");
var jsDAV_iCollection = require("jsDAV/lib/DAV/interfaces/iCollection");
var jsDAV_SimpleCollection = require("jsDAV/lib/DAV/simpleCollection");
var jsDAVACL_iPrincipal = require("jsDAV/lib/DAVACL/interfaces/iPrincipal");
var jsCardDAV_iAddressBook = require("jsDAV/lib/CardDAV/interfaces/iAddressBook");
var jsCardDAV_iCard = require("jsDAV/lib/CardDAV/interfaces/iCard");

var Exc = require("jsDAV/lib/shared/exceptions");
var Util = require("jsDAV/lib/shared/util");

var Fs = require("fs");
var Path = require("path");
var Url = require("url");
var Async = require("./../node_modules/jsDAV/node_modules/asyncjs");
var Formidable = require("./../node_modules/jsDAV/node_modules/formidable");

var Handlebars = require("handlebars");
var mainTmpl = Fs.readFileSync(__dirname + "/assets/templates/main.hbs").toString();

/**
 * Browser Plugin
 *
 * This plugin provides a html representation, so that a WebDAV server may be accessed
 * using a browser.
 *
 * The class intercepts GET requests to collection resources and generates a simple
 * html index.
 */
var jsDAV_Browser_Plugin = module.exports = jsDAV_ServerPlugin.extend({
  /**
   * Plugin name
   *
   * @var String
   */
  name: "browser",

  /**
   * List of default icons for nodes.
   *
   * This is an array with class / interface names as keys, and asset names
   * as values.
   *
   * The evaluation order is reversed. The last item in the list gets
   * precendence.
   *
   * @var array
   */
  iconMap: {
    "icons/file": jsDAV_iFile,
    "icons/collection": jsDAV_iCollection,
    "icons/principal": jsDAVACL_iPrincipal,
    //        "icons/calendar": jsCalDAV_iCalendar,
    "icons/addressbook": jsCardDAV_iAddressBook,
    "icons/card": jsCardDAV_iCard
  },

  /**
   * The file extension used for all icons
   *
   * @var string
   */
  iconExtension: ".png",

  /**
   * reference to handler class
   *
   * @var jsDAV_Handler
   */
  handler: null,

  initialize: function(handler) {
    this.handler = handler;
    var enablePost = handler.server.options.enablePost;
    this.enablePost = typeof enablePost == "boolean" ? enablePost : true;
    var enableAssets = handler.server.options.enableAssets;
    this.enableAssets = typeof enableAssets == "boolean" ? enableAssets : true;
    handler.addEventListener("beforeMethod", this.httpGetInterceptor.bind(this));
    handler.addEventListener("onHTMLActionsPanel", this.htmlActionsPanel.bind(this));
    if (this.enablePost)
      handler.addEventListener("unknownMethod", this.httpPOSTHandler.bind(this));
  },

  /**
   * This method intercepts GET requests to collections and returns the html
   *
   * @param {String} method
   * @return bool
   */
  httpGetInterceptor: function(e, method) {
    if (method != "GET")
      return e.next();

    // We're not using straight-up $_GET, because we want everything to be
    // unit testable.
    var getVars = Url.parse(this.handler.httpRequest.url, true).query;

    if (getVars.jsdavAction && getVars.jsdavAction == "asset" && getVars.assetName)
      return this.serveAsset(e, getVars.assetName);

    var uri = this.handler.getRequestUri();
    var self = this;
    this.handler.getNodeForPath(uri, function(err, node) {
      if (err || node.hasFeature(jsDAV_iFile))
        return e.next();

      self.generateDirectoryIndex(uri, function(err, sIndex) {
        if (err)
          return e.next(err);
        e.stop();
        self.handler.httpResponse.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8"
        });
        self.handler.httpResponse.end(sIndex);
      });
    });
  },

  /**
   * Handles POST requests for tree operations
   *
   * This method is not yet used.
   *
   * @param {String} method
   * @return bool
   */
  httpPOSTHandler: function(e, method, uri) {
    if (method != "POST")
      return e.next();

    var contentType = this.handler.httpRequest.headers["content-type"];
    contentType = contentType.split(";")[0];
    if (contentType != "application/x-www-form-urlencoded" &&
      contentType != "multipart/form-data") {
      return e.next();
    }

    var self = this;
    var form = new Formidable.IncomingForm();
    form.uploadDir = self.handler.server.tmpDir;

    // Fields that we expect to come in:
    var postVars = {};

    form.on("field", function(fieldName, fieldValue) {
      postVars[fieldName] = Util.trim(fieldValue);
    });

    form.on("file", function(field, fileObj) {
      postVars.file = fileObj;
    });

    form.on("error", e.next.bind(e));
    form.on("aborted", function() {
      e.next(new Exc.BadRequest());
    });

    // Disabled as currently using HTML5 progress bar and XMLHTTPRequest
    // form.on("progress", function(bytesReceived, bytesExpected) {
    //   var progress = {
    //     type: "progress",
    //     bytesReceived: bytesReceived,
    //     bytesExpected: bytesExpected,
    //     percent: Math.round((bytesReceived/bytesExpected) * 100)
    //   };
    // });

    form.on("end", function() {
      var action = postVars.jsdavAction;
      if (!action)
        return e.next();

      function finish(err) {
        if (err)
          return e.next(err);
        e.stop();
        self.handler.httpResponse.writeHead(302, {
          "location": self.handler.httpRequest.url
        });
        self.handler.httpResponse.end();
      }

      self.handler.dispatchEvent("onBrowserPostAction", uri, action, postVars, function(stop) {
        if (!stop) {
          var name = postVars.name;
          if (action == "mkcol" && name) {
            // Using basename() because we won't allow slashes
            var folderName = Util.splitPath(name)[1] || name;
            self.handler.createDirectory(uri + "/" + folderName, finish);
          } else if (action == "put") {
            var file = postVars.file;
            var newName = name ? name : file.name ? file.name : Util.splitPath(file.path)[1];
            // Making sure we only have a 'basename' component
            newName = Util.splitPath(newName)[1] || newName;
            uri = uri + "/" + newName;

            var parts = Util.splitPath(uri);
            var dir = parts[0];
            var name = parts[1];
            self.handler.getNodeForPath(dir, function(err, parent) {
              if (err)
                return e.next(err);

              var dataOrStream;
              if (parent.createFileStreamRaw) {
                dataOrStream = Fs.createReadStream(file.path);
                createFile();
              } else {
                // IMPORTANT: This does NOT support streaming
                // copy/ move, possible memory hazard.
                Fs.readFile(file.path, function(err, buf) {
                  if (err)
                    return e.next(err);
                  dataOrStream = buf;
                  createFile();
                });
              }

              function createFile() {
                self.handler.createFile(uri, dataOrStream, "binary", function(err) {
                  if (err)
                    return e.next(err);
                  // Clean up:
                  Fs.unlink(file.path, finish);
                });
              }
            });
          }
        } else if (stop !== true)
          e.next();
        else
          finish();
      });
    });

    form.parse(self.handler.httpRequest);
  },

  /**
   * Escapes a {String} for html.
   *
   * @param {String} value
   * @return void
   */
  escapeHTML: function(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

  /**
   * Generates the html directory index for a given url
   *
   * @param {String} path
   * @return string
   */
  generateDirectoryIndex: function(path, cbindex) {
    var self = this;

    var template = Handlebars.compile(mainTmpl);

    self.handler.getPropertiesForPath(path, [
      "{DAV:}displayname",
      "{DAV:}resourcetype",
      "{DAV:}getcontenttype",
      "{DAV:}getcontentlength",
      "{DAV:}getlastmodified"
    ], 1, function(err, files) {
      if (err)
        return cbindex(err);

      self.handler.getNodeForPath(path, function(err, parent) {
        if (err)
          return cbindex(err);

        var html, name, encodedName, displayName, type, typeClass, size,
          lastmodified, fullPath, i, l;

        var parentPath = null,
          breadcrumb = null,
          entries = [];

        if (path) {
          var parentUri = Util.splitPath(path)[0];
          //fullPath = encodeURI(self.handler.server.getBaseUri() + parentUri);
          parentPath = encodeURI(self.handler.server.getBaseUri() + parentUri);
          breadcrumb = self.escapeHTML(path).split("/");
        }

        Async.list(Object.keys(files))
          .each(function(filename, next) {
            var file = files[filename];
            // This is the current directory, we can skip it
            if (Util.rtrim(file["href"], "/") == path)
              return next();

            encodedName = encodeURI(Util.splitPath(file["href"])[1] || "");
            name = Util.splitPath(file["href"])[1] || "";

            type = null;

            if (file["200"]["{DAV:}resourcetype"]) {
              type = file["200"]["{DAV:}resourcetype"].getValue();

              // resourcetype can have multiple values
              if (!Array.isArray(type))
                type = [type];

              for (i = 0, l = type.length; i < l; ++i) {
                // Some name mapping is preferred
                switch (type[i]) {
                  case "{DAV:}collection":
                    type[i] = "Directory";
                    break;
                  case "{DAV:}principal":
                    type[i] = "Principal";
                    break;
                  case "{urn:ietf:params:xml:ns:carddav}addressbook":
                    type[i] = "Addressbook";
                    break;
                  case "{urn:ietf:params:xml:ns:caldav}calendar":
                    type[i] = "Calendar";
                    break;
                  case "{urn:ietf:params:xml:ns:caldav}schedule-inbox":
                    type[i] = "Schedule Inbox";
                    break;
                  case "{urn:ietf:params:xml:ns:caldav}schedule-outbox":
                    type[i] = "Schedule Outbox";
                    break;
                  case "{http://calendarserver.org/ns/}calendar-proxy-read":
                    type[i] = "Proxy-Read";
                    break;
                  case "{http://calendarserver.org/ns/}calendar-proxy-write":
                    type[i] = "Proxy-Write";
                    break;
                }
              }
              type = type.join(", ");
            }

            // If no resourcetype was found, we attempt to use
            // the contenttype property
            if (!type && !Util.empty(file["200"]["{DAV:}getcontenttype"])) {
              type = file["200"]["{DAV:}getcontenttype"];
            }
            if (!type)
              type = "Unknown";

            type = self.escapeHTML(type.replace(/;.*$/, ""));
            var rootClass = type.split("/").shift();
            if (rootClass === "image") {
              typeClass = "image";
            } else if (rootClass === "audio") {
              typeClass = "audio";
            } else if (rootClass === "video") {
              typeClass = "video";
            } else if (type === "Directory") {
              typeClass = "folder";
            } else {
              typeClass = null;
            }

            size = file["200"]["{DAV:}getcontentlength"];
            if (!size || isNaN(parseInt(size)))
              size = "";
            lastmodified = !Util.empty(file["200"]["{DAV:}getlastmodified"]) ? Util.dateFormat(file["200"]["{DAV:}getlastmodified"].getTime(), Util.DATE_RFC822) : "";

            fullPath = "/" + Util.trim(self.handler.server.getBaseUri() + (path ? path + "/" : "") + encodedName, "/");

            displayName = typeof file["200"]["{DAV:}displayname"] == "string" ? file["200"]["{DAV:}displayname"] : name;

            addEntry();

            function addEntry() {
              entries.push({
                "href": fullPath,
                "name": self.escapeHTML(displayName),
                "class": typeClass,
                "type": type,
                "size": size,
                "lastmodified": lastmodified
              });
              next();
            }
          })
          .end(function() {

            var output = {};

            if (self.enablePost) {
              self.handler.dispatchEvent("onHTMLActionsPanel", parent, output, function() {
                onEnd();
              });
            } else
              onEnd();

            function onEnd() {
              Handlebars.registerHelper("breadcrumbs", function() {
                return "/" + breadcrumb.slice(0, breadcrumb.indexOf(this) + 1).join("/");
              });
              html = template({
                "title": self.escapeHTML(path),
                "enableAssets": self.enableAssets,
                "css": self.getAssetUrl("css/jsdav.css"),
                "favicon": self.getAssetUrl("icons/favicon.ico"),
                "script": self.getAssetUrl("js/browserscripts.js"),
                "breadcrumb": breadcrumb,
                "path": path,
                "parentPath": parentPath,
                "entries": entries,
                "enablePost": self.enablePost
              });
              cbindex(null, html);
            }
          });
      });
    });
  },

  /**
   * This method is used to generate the 'actions panel' output for
   * collections.
   *
   * This specifically generates the interfaces for creating new files, and
   * creating new directories.
   *
   * @param DAV\INode $node
   * @param {mixed} $output
   * @return void
   */
  htmlActionsPanel: function(e, node) {
    if (!node.hasFeature(jsDAV_iCollection))
      return e.next();

    // We also know fairly certain that if an object is a non-extended
    // SimpleCollection, we won't need to show the panel either.
    if (node.hasFeature(jsDAV_SimpleCollection))
      return e.next();

    e.stop();
  },

  /**
   * This method takes a path/name of an asset and turns it into url
   * suiteable for http access.
   *
   * @param {String} $assetName
   * @return string
   */
  getAssetUrl: function(assetName) {
    return this.handler.server.getBaseUri() + "?jsdavAction=asset&assetName=" + encodeURIComponent(assetName);
  },

  /**
   * This method returns a local pathname to an asset.
   *
   * @param {String} assetName
   * @return string
   */
  getLocalAssetPath: function(assetName) {
    // Making sure people aren't trying to escape from the base path.
    if (assetName.split("/").indexOf("..") > -1)
      throw new Exc.jsDAV_Exception("Incorrect asset path");

    return __dirname + "/assets/" + assetName;
  },

  /**
   * This method reads an asset from disk and generates a full http response.
   *
   * @param {String} assetName
   * @return void
   */
  serveAsset: function(e, assetName) {
    var assetPath;
    try {
      assetPath = this.getLocalAssetPath(decodeURIComponent(assetName));
    } catch (ex) {
      return e.next(ex);
    }

    var self = this;
    if (!this.assetCache)
      this.assetCache = {};
    if (!this.assetCache[assetPath]) {
      Fs.stat(assetPath, function(err, stat) {
        if (err)
          return e.next(new Exc.NotFound("Could not find an asset with this name"));

        self.assetCache[assetPath] = stat;
        serveAsset(stat);
      });
    } else
      serveAsset(this.assetCache[assetPath]);

    function serveAsset(stat) {
      // Rudimentary mime type detection
      var mime;
      switch (Path.extname(assetPath).toLowerCase()) {
        case ".ico":
          mime = "image/vnd.microsoft.icon";
          break;
        case ".png":
          mime = "image/png";
          break;
        case ".css":
          mime = "text/css";
          break;
        case ".js":
          mime = "text/javascript";
          break;
        default:
          mime = "application/octet-stream";
          break;
      }

      var headWritten = false;

      function writeHeadOnce() {
        if (headWritten)
          return headWritten;
        self.handler.httpResponse.writeHead(200, {
          "content-type": mime,
          "content-length": stat.size,
          "cache-control": "public, max-age=1209600"
        });
        return (headWritten = true);
      }

      var stream = Fs.createReadStream(assetPath);
      stream.on("data", function(data) {
        writeHeadOnce();
        self.handler.httpResponse.write(data);
      });
      stream.on("error", function(err) {
        if (headWritten)
          return;
        e.next(err);
      });
      stream.on("end", function() {
        e.stop();
        self.handler.httpResponse.end();
      });
    }
  }
});
