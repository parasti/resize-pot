var JSZip = require('jszip');

var imageList = {};

function addImage (file) {
  var name = file.name;
  var container = document.querySelector('#thumbs');

  if (!imageList[name]) {
    // Add new thumbnail.

    var image = {
      file: null,
      imgElem: null,
      thumbElem: null
    };

    // Remove thumbnail on load error. Probably not an image file.
    var onerror = (function (name) {
      return function () {
        var image = imageList[name];
        image.thumbElem.parentNode.removeChild(image.thumbElem);
        delete imageList[name];
      };
    })(name);

    var imgElem = createImg(file, onerror);
    var thumbElem = createThumb(imgElem, name);

    image.file = file;
    image.imgElem = imgElem;
    image.thumbElem = thumbElem;

    imageList[name] = image;

    container.appendChild(image.thumbElem);
  } else {
    // Re-add if removed by user.
    if (imageList[name].thumbElem.parentNode === null) {
      container.appendChild(imageList[name].thumbElem);
    }
  }
}

function createImg (file, onerror) {
  var img = document.createElement('img');

  var url = window.URL.createObjectURL(file);
  var revokeURL = function () {
    window.URL.revokeObjectURL(url);
  };

  img.addEventListener('load', revokeURL);
  img.addEventListener('error', revokeURL);
  img.addEventListener('error', onerror);

  img.src = url;
  img.alt = file.name;
  img.title = file.name;

  return img;
}

function createThumb (img, name) {
  var thumb = document.createElement('div');
  thumb.className = 'thumb';

  var close = document.createElement('span');
  close.title = 'Remove ' + name;
  close.innerHTML = '&times;';
  close.className = 'close';
  close.addEventListener('click', function () {
    thumb.parentNode.removeChild(thumb);
  });

  thumb.appendChild(close);
  thumb.appendChild(img);

  return thumb;
}

function near2 (n) {
  return Math.pow(2, Math.round(Math.log2(n)));
}

function resizeImage (img) {
  var w = img.naturalWidth;
  var h = img.naturalHeight;

  var w2 = near2(w);
  var h2 = near2(h);

  if (w2 === w && h2 === h) {
    return null;
  }

  // Enforce max. image size.

  var maxExp = document.querySelector('#max-exponent').value;
  var maxSize = Math.pow(2, maxExp);
  var ratio = Math.max(w2, h2) / maxSize;

  if (ratio > 1) {
    w2 /= ratio;
    h2 /= ratio;
  }

  // Draw to a canvas.

  var canvas = document.createElement('canvas');

  canvas.width = w2;
  canvas.height = h2;

  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w2, h2);

  return canvas;
}

function canvasToBlob (canvas, type) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) { resolve(blob); }, type);
  });
}

function setBlobName (name) {
  return function (blob) {
    // Hack: blobs don't have a .name property.
    // We're adding it to be able to interchange Blobs and Files.
    blob.name = name;
    return blob;
  };
}

function resizeImages () {
  var proms = [];

  for (var name in imageList) {
    var image = imageList[name];

    if (image.thumbElem.parentNode === null) {
      // Skip removed images.
      continue;
    }

    var img = imageList[name].imgElem;
    var file = imageList[name].file;

    var canvas = resizeImage(img);

    if (canvas) {
      proms.push(canvasToBlob(canvas, file.type).then(setBlobName(file.name)));
    } else {
      proms.push(Promise.resolve(file));
    }
  }

  if (!proms.length) {
    return;
  }

  Promise.all(proms).then(function (imageBlobs) {
    var zip = new JSZip();

    for (var i = 0, n = imageBlobs.length; i < n; ++i) {
      zip.file(imageBlobs[i].name, imageBlobs[i]);
    }

    zip.generateAsync({type: 'blob'}).then(addDownloadLink);
  });
}

function addDownloadLink (blob) {
  var size = Math.round(blob.size / 1024) + 'kB';
  var btn = createButton('Download ZIP (' + size + ')');

  btn.download = 'pot-images-' + Date.now() + '.zip';
  btn.href = window.URL.createObjectURL(blob);

  document.querySelector('#container').appendChild(btn);
}

function createButton (text) {
  var btn = document.createElement('a');
  btn.href = '#';
  btn.className = 'button';

  var span = document.createElement('span');
  span.innerText = text;

  btn.appendChild(span);
  return btn;
}

function dropHandler (e) {
  var files = e.dataTransfer.files;

  for (var i = 0; i < files.length; ++i) {
    addImage(files[i]);
  }
  e.preventDefault();
}

function dragOverHandler (e) {
  e.preventDefault();
}

function initDrag () {
  document.addEventListener('drop', dropHandler);
  document.addEventListener('dragover', dragOverHandler);
}

function initUI () {
  var btn = createButton('Resize');

  btn.addEventListener('click', function (e) {
    resizeImages();
    e.preventDefault();
  });

  document.querySelector('#container').appendChild(btn);

  var expInput = document.querySelector('#max-exponent');
  var sizeSpan = document.querySelector('#max-size');

  var defaultExponent = 8;

  expInput.value = defaultExponent;
  sizeSpan.innerText = Math.pow(2, defaultExponent) + 'px';

  expInput.addEventListener('input', function () {
    sizeSpan.innerText = Math.pow(2, this.value) + 'px';
  });
}

initUI();
initDrag();
