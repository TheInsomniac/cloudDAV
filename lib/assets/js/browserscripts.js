function uploadFile(form) {
  "use strict";
  var formData = new FormData(form);
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "", true);
  xhr.onload = function() {
      document.location.reload();
  };
  var progressBar = document.querySelector("progress");
  xhr.upload.onprogress = function(e) {
      if (e.lengthComputable) {
        progressBar.style.visibility = "visible";
        progressBar.value = (e.loaded / e.total) * 100;
        progressBar.textContent = progressBar.value + "% complete"; // Fallback for unsupported browsers.
      }
    };
  xhr.send(formData);
  return false; // Prevent page from submitting.
}

(function() {
  "use strict";

  var addEvent = function (node, type, fn) {
    var el = document.querySelector(node);
    el.addEventListener(type, fn, false);
  };

  var fade = document.getElementById("fade");
  var uploadFile = document.getElementById("uploadFile");
  var newFolder = document.getElementById("newFolder");
  var audioPlayer = document.getElementById("audioPlayer");
  var contextMenu = document.getElementById("contextMenu");
  var modal = document.querySelector(".modal");
  var fileChooser = document.getElementById("fileChooser");
  var fileInfo = document.getElementById("fileInfo");

  fileChooser.onchange = function() {
    var info;
    info = "<div><span>Name:</span> " + this.files[0].name + "</div>";
    info += "<div><span>Size:</span> " + parseInt(this.files[0].size / 1024, 10) + " kB</div>";
    info += "<div><span>Type:</span> " + this.files[0].type + "</div>";
    fileInfo.innerHTML = info;

    //TODO: this is WIP. Should we have the file automatically upload upon
    //selecting or only after hitting submit?
    //fileUpload(this.files[0]);

  };

  // function fileUpload(file) {
  //   var formData = new FormData();
  //   formData.append("jsdavAction", "put");
  //   formData.append("file", file);
  //   var xhr = new XMLHttpRequest();
  //   xhr.open("POST", "", true);
  //   xhr.onload = function() {
  //     document.location.reload();
  //   };
  //   var progressBar = document.querySelector("progress");
  //   xhr.upload.onprogress = function(e) {
  //       if (e.lengthComputable) {
  //         progressBar.value = (e.loaded / e.total) * 100;
  //         progressBar.textContent = progressBar.value + "% complete"; // Fallback for unsupported browsers.
  //       }
  //     };
  //   xhr.send(formData);
  // }

  addEvent("#btnNew", "click", function() {
    fade.style.display = "block";
    newFolder.style.display = "block";
  });
  addEvent("#btnUp", "click", function() {
    fade.style.display = "block";
    uploadFile.style.display = "block";
  });
  addEvent("#fade", "click", function() {
    fade.style.display = "none";
    newFolder.style.display = "none";
    uploadFile.style.display = "none";
    modal.style.display = "none";
    audioPlayer.style.display = "none";
  });

  addEvent("table", "click", function(el) {
    if (el.target.nodeName === "A" &&
      el.target.className !== "folder" &&
      el.target.className !== "parent") {
      el.preventDefault();
      if (el.target.className === "image") {
        var img = modal.querySelector("img");
        var a = modal.querySelector("a");

        //img = document.querySelector(".modal img");
        img.setAttribute("src", el.target.href);

        //a = document.querySelector(".modal a");
        a.setAttribute("href", el.target.href);
        a.setAttribute("download", el.target.textContent);

        fade.style.display = "block";
        modal.style.display = "block";
      }
      if (el.target.className === "audio") {
        var audioPlayerTitle = audioPlayer.querySelector(".overlayTitle");
        audioPlayerTitle.textContent = "Playing: " + el.target.textContent;
        var contentType = el.target.parentNode.nextElementSibling.textContent;
        var player = audioPlayer.querySelector("div");
        player.innerHTML = "<audio " +
        "controls autoplay name=media>" +
        "<source src=" + el.target.href + " type=" + contentType + ">" +
        "</audio>";
        fade.style.display = "block";
        audioPlayer.style.display = "block";
        // var audio = document.getElementsByTagName('audio').media;
        // audio.play();
        // audio.pause();
        // audio.paused; // bool
      }
    }
  });

  addEvent("table", "contextmenu", function(el) {
    if (el.target.nodeName === "A") {
      el.preventDefault();
      if (el.target.className !== "parent") {
        createContextMenu(el);
        var src = el.target.pathname;
        addEvent("#cmenuCancel", "click", function() {
          contextMenu.style.display = "none";
        });
        addEvent("#cmenuDownload", "click", function() {
          contextMenu.style.display = "none";
          document.location = el.target.href;
        });
        addEvent("#cmenuDelete", "click", function() {
          contextMenu.style.display = "none";
          var ruSure = confirm("Are you sure?\nThis CANNOT be undone.");
          if (ruSure === true) {
              deleteItem(src);
          } else {
              //pass
          }
        });
        addEvent("#cmenuCopy", "click", function() {
          contextMenu.style.display = "none";
          var dest = prompt("Please enter the destination folder\n" +
            "and name. Only absolute paths are\n" +
            "acceptable. [/folder1/folder2/filename.ext]\n" +
            "NOT relative paths such as [../../filename.ext]", src);
          if (dest !== null) {
            copyItem(src, dest);
          }
        });
        addEvent("#cmenuRename", "click", function() {
          contextMenu.style.display = "none";
          var dest = prompt("Please enter the destination folder\n" +
            "and name. Only absolute paths are\n" +
            "acceptable. [/folder1/folder2/filename.ext]\n" +
            "NOT relative paths such as [../../filename.ext]", src);
          if (dest !== null) {
            moveItem(src, dest);
          }
        });
      }
    }
  }, false);

  function createContextMenu(el) {
    contextMenu.style.top = mouseXY("y", el) + "px";
    contextMenu.style.left = mouseXY("x", el) + "px";
    contextMenu.style.display = "block";
  }

  function deleteItem(src) {
    var xmlHttp = null;
    xmlHttp = new XMLHttpRequest();
    xmlHttp.open("DELETE", src, false);
    xmlHttp.send(null);
    if (xmlHttp.responseText) {
      var res = xmlHttp.responseText;
      var parser = new DOMParser();
      var xml = parser.parseFromString(res,"text/xml");
      alert(xmlHttp.status + " : " + xml.documentElement.querySelector("exception").textContent);
    } else {
      document.location.reload();
    }
  }

  function moveItem(src, dest) {
    var xmlHttp = null;
    xmlHttp = new XMLHttpRequest();
    xmlHttp.open("MOVE", src, false);
    xmlHttp.setRequestHeader("Destination", dest);
    xmlHttp.send(null);
    if (xmlHttp.status === 409) {
      alert("Error : Destination Folder does not exist");
    } else {
      document.location.reload();
    }
  }

  function copyItem(src, dest) {
    var xmlHttp = null;
    xmlHttp = new XMLHttpRequest();
    xmlHttp.open("COPY", src, false);
    xmlHttp.setRequestHeader("Destination", dest);
    xmlHttp.send(null);
    if (xmlHttp.status === 409) {
      alert("Error : Destination Folder does not exist");
    } else {
      document.location.reload();
    }
  }

function mouseXY(axis, evt) {
  /* Return X axis location */
  if (axis.toLowerCase() === "x") {
    if (evt.pageX) {
        return evt.pageX;
    } else if (evt.clientX) {
       return evt.clientX + (document.documentElement.scrollLeft ?
           document.documentElement.scrollLeft :
           document.body.scrollLeft);
    } else {
        return null;
    }
  /* Return Y axis location */
} else if (axis.toLowerCase() === "y")
    if (evt.pageY) {
        return evt.pageY;
    } else if (evt.clientY) {
       return evt.clientY + (document.documentElement.scrollTop ?
       document.documentElement.scrollTop :
       document.body.scrollTop);
    } else {
        return null;
    }
}
})();
