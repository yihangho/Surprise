function getPixelsMatrix(input, fn) {
  var file = input.files[0];
  var fr   = new FileReader();
  fr.addEventListener('load', function() {
    var img = new Image();

    img.addEventListener('load', function() {
      var canvas = document.createElement('canvas');

      // Perform scaling such that the canvas is at most as large as the viewport
      var aspectRatio = img.width / img.height;
      var viewportWidth  = document.documentElement.clientWidth;
      var viewportHeight = document.documentElement.clientHeight;
      if (aspectRatio < 1) {
        canvas.width  = Math.min(img.width, viewportWidth);
        canvas.height = canvas.width / aspectRatio;
      } else {
        canvas.height = Math.min(img.height, viewportHeight);
        canvas.width  = canvas.height * aspectRatio;
      }

      canvas.width  = Math.round(canvas.width);
      canvas.height = Math.round(canvas.height);

      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      var imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);

      if (typeof fn === 'function') fn(imageData);
    });
    img.src = fr.result;
  });
  fr.readAsDataURL(file);
}

function Pixel(r, g, b, a) {
  if (typeof this.constructor.prototype.toRgba !== 'function') {
    this.constructor.prototype.toRgba = function() {
      // All the Math.round are important as the params for rgba and rgb notation
      // should be integer.
      return "rgba(" + Math.round(this.r) + "," + Math.round(this.g) + "," + Math.round(this.b) + "," + Math.round(this.a) +")";
    };
  }

  this.r = r;
  this.g = g;
  this.b = b;
  this.a = a;
}

Pixel.average = function() {
  var filteredPixels = Array.prototype.filter.call(arguments, function(p) {
    return p && p.constructor == Pixel;
  });

  return filteredPixels.reduce(function(accumulator, current) {
    accumulator.r += current.r / filteredPixels.length;
    accumulator.g += current.g / filteredPixels.length;
    accumulator.b += current.b / filteredPixels.length;
    accumulator.a += current.a / filteredPixels.length;
    return accumulator;
  }, new Pixel(0, 0, 0, 0));
};

function PixelsCollection(width, height, actualWidth, actualHeight) {
  if (typeof this.constructor.prototype.render !== 'function') {
    this.constructor.prototype.render = function() {
      // Renders and returns the current collection on a canvas
      // Mainly for debugging purpose
      var canvas    = document.createElement('canvas');
      canvas.width  = this.width;
      canvas.height = this.height;
      var context   = canvas.getContext('2d');
      for (var i = 0; i < this.height; i++) {
        for (var j = 0; j < this.width; j++) {
          if (this.get(i, j)) {
            context.fillStyle = this.get(i, j).toRgba();
            context.fillRect(j, i, 1, 1);
          }
        }
      }

      return canvas;
    };

    this.constructor.prototype.nextLayer = function() {
      // returns the scale down version
      var width   = this.actualWidth / 2;
      var height  = this.actualHeight / 2;
      var iWidth  = Math.ceil(this.width / 2);
      var iHeight = Math.ceil(this.height / 2);
      var output  = new PixelsCollection(iWidth, iHeight, width, height);

      for (var i = 0; i < iHeight; i++) {
        for (var j = 0; j < iWidth; j++) {
          var averagePixel = Pixel.average(this.get(2*i,   2*j),
                                           this.get(2*i+1, 2*j),
                                           this.get(2*i,   2*j+1),
                                           this.get(2*i+1, 2*j+1));
          output.set(i, j, averagePixel);
        }
      }

      return output;
    }
  }
  var collection = [];
  for (var i = 0; i < height; i++) collection.push(new Array(width));

  function valid(collection, x, y) {
    return x >= 0 && x < collection.length && y >= 0 && y < collection[0].length;
  }
  this.get = function(x, y) {
    if (valid(collection, x, y)) {
      return collection[x][y];
    } else {
      return null;
    }
  };

  this.set = function(x, y, val) {
    if (valid(collection, x, y)) collection[x][y] = val;
  };

  this.renderOnSVG = function(layer, x, y, svg) {
    var svgWidth  = svg.getAttributeNS(null, 'width');
    var svgHeight = svg.getAttributeNS(null, 'height');
    var scale     = svgWidth / this.actualWidth;
    var radius    = scale / 2;

    if (!this.get(x, y)) {
      return;
    }

    var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttributeNS(null, 'cx',   y * scale + radius);
    circle.setAttributeNS(null, 'cy',   x * scale + radius);
    circle.setAttributeNS(null, 'r',    radius);
    circle.setAttributeNS(null, 'fill', this.get(x, y).toRgba());

    circle.setAttributeNS('surprise', 'layer', layer);
    circle.setAttributeNS('surprise', 'x', x);
    circle.setAttributeNS('surprise', 'y', y);

    svg.appendChild(circle);

    return circle;
  };

  this.width  = width;
  this.height = height;
  // We need actual width and height to correctly render partial pixels
  this.actualWidth  = actualWidth;
  this.actualHeight = actualHeight;
}

PixelsCollection.fromImageData = function(imageData) {
  var output = new PixelsCollection(imageData.width, imageData.height, imageData.width, imageData.height);

  for (var i = 0; i < imageData.height; i++) {
    for (var j = 0; j < imageData.width; j++) {
      var base  = (i * imageData.width + j) * 4;
      var pixel = new Pixel(imageData.data[base], imageData.data[base+1], imageData.data[base+2], imageData.data[base+3]);
      output.set(i, j, pixel);
    }
  }

  return output;
}

var fileInput = document.getElementById('fileInput');
var submitBtn = document.getElementById('loadImageBtn');

submitBtn.addEventListener('click', function() {
  getPixelsMatrix(fileInput, function(imageData) {
    var layers = [PixelsCollection.fromImageData(imageData)];

    do {
      layers.unshift(layers[0].nextLayer());
    } while (layers[0].width !== 1 || layers[0].width !== 1);

    var drawingBoard = document.getElementById('drawingBoard');
    drawingBoard.setAttributeNS(null, 'width',  layers[layers.length - 1].width);
    drawingBoard.setAttributeNS(null, 'height', layers[layers.length - 1].height);

    layers[0].renderOnSVG(0, 0, 0, drawingBoard);

    var fencing = null;

    var drawingBoardTop  = drawingBoard.getBoundingClientRect().top;
    var drawingBoardLeft = drawingBoard.getBoundingClientRect().left;

    drawingBoard.addEventListener('mousemove', function(e) {
      var x = e.x - drawingBoardLeft;
      var y = e.y - drawingBoardTop;

      if (fencing && x >= fencing.x && x <= fencing.x + fencing.r &&
                     y >= fencing.y && y <= fencing.y + fencing.r) {
          return;
      }
      if (e.toElement.tagName !== 'circle') {
        fencing = null;
        return;
      }

      var circle = e.toElement;
      var cx = parseFloat(circle.getAttributeNS(null, 'cx'));
      var cy = parseFloat(circle.getAttributeNS(null, 'cy'));
      var r  = parseFloat(circle.getAttributeNS(null, 'r'));

      var layer  = parseInt(circle.getAttributeNS('surprise', 'layer'));
      var xIndex = parseInt(circle.getAttributeNS('surprise', 'x'));
      var yIndex = parseInt(circle.getAttributeNS('surprise', 'y'));

      if (layer != layers.length - 1) {
        drawingBoard.removeChild(circle);

        layers[layer+1].renderOnSVG(layer+1, 2*xIndex,   2*yIndex,   drawingBoard);
        layers[layer+1].renderOnSVG(layer+1, 2*xIndex+1, 2*yIndex,   drawingBoard);
        layers[layer+1].renderOnSVG(layer+1, 2*xIndex,   2*yIndex+1, drawingBoard);
        layers[layer+1].renderOnSVG(layer+1, 2*xIndex+1, 2*yIndex+1, drawingBoard);

        fencing = {
          x: (x <= cx ? cx - r : cx),
          y: (y <= cy ? cy - r : cy),
          r: r
        };
      }
    });
  });
});
