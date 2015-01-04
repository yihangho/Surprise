function constructMatrix(x, y) {
  var output = [];
  for (var i = 0; i < x; i++) output.push(new Array(y));
  return output;
}

function getPixelsMatrix(input, fn) {
  var file = input.files[0];
  var fr   = new FileReader();
  fr.addEventListener('load', function() {
    var img = new Image();
    img.addEventListener('load', function() {
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      canvas.getContext('2d').drawImage(img, 0, 0);
      var imageData = canvas.getContext('2d').getImageData(0, 0, 256, 256).data;
      var output = constructMatrix(256, 256);

      for (var i = 0; i < 256; i++) {
        for (var j = 0; j < 256; j++) {
          var base = (i * 256 + j) * 4;
          output[i][j] = new Pixel(imageData[base], imageData[base+1], imageData[base+2], imageData[base+3]);
        }
      }

      if (typeof fn === 'function') fn(output);
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

var fileInput = document.getElementById('fileInput');
var submitBtn = document.getElementById('loadImageBtn');

submitBtn.addEventListener('click', function() {
  getPixelsMatrix(fileInput, function(matrix) {
    function render(container, matrix, layer, x, y) {
      var pixel = matrix[layer][x][y];
      var scale = 256 / matrix[layer].length;
      var radius = scale / 2;

      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttributeNS(null, 'cx',   x * scale + radius);
      circle.setAttributeNS(null, 'cy',   y * scale + radius);
      circle.setAttributeNS(null, 'r',    radius);
      circle.setAttributeNS(null, 'fill', pixel.toRgba());

      circle.setAttributeNS('surprise', 'layer', layer);
      circle.setAttributeNS('surprise', 'x', x);
      circle.setAttributeNS('surprise', 'y', y);

      container.appendChild(circle);

      return circle;
    }

    var pixelsLayers = new Array(9);
    pixelsLayers[8] = matrix;

    for (var i = 7; i >= 0; i--) {
      var prevLayer = pixelsLayers[i+1];
      pixelsLayers[i] = constructMatrix(1 << i, 1 << i);
      for (var x = 0; x < (1 << i); x++) {
        for (var y = 0; y < (1 << i); y++) {
          pixelsLayers[i][x][y] = Pixel.average(prevLayer[2*x][2*y], prevLayer[2*x][2*y+1], prevLayer[2*x+1][2*y], prevLayer[2*x+1][2*y+1]);
        }
      }
    }

    // We have all layers by now
    // Let's paint layer 0 on the drawing board

    var drawingBoard = document.getElementById('drawingBoard');
    render(drawingBoard, pixelsLayers, 0, 0, 0);

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

      if (layer != 8) {
        drawingBoard.removeChild(circle);

        render(drawingBoard, pixelsLayers, layer+1, 2*xIndex,   2*yIndex);
        render(drawingBoard, pixelsLayers, layer+1, 2*xIndex+1, 2*yIndex);
        render(drawingBoard, pixelsLayers, layer+1, 2*xIndex,   2*yIndex+1);
        render(drawingBoard, pixelsLayers, layer+1, 2*xIndex+1, 2*yIndex+1);

        fencing = {
          x: (x <= cx ? cx - r : cx),
          y: (y <= cy ? cy - r : cy),
          r: r
        };
      }
    });
  });
});
