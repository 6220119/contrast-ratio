/**
 * Created by Android22 on 5/31/2014.
 */
(function (PrefixFree, Color, Incrementable, $) {
  'use strict';

  var app = angular.module('colorContrast', ['angularSpectrumColorpicker']),
    UPDATE_SCORE = 'UPDATE_SCORE',
    UPDATE_FAV_ICON = 'UPDATE_FAV_ICON',
    messages = {
      'semitransparent': 'The background is semi-transparent, so the contrast ratio cannot be precise. Depending on what’s going to be underneath, it could be any of the following:',
      'fail': 'Fails WCAG 2.0 :-(',
      'aa-large': 'Passes AA for large text (above 18pt or bold above 14pt)',
      'aa': 'Passes AA level for any size text and AAA for large text (above 18pt or bold above 14pt)',
      'aaa': 'Passes AAA level for any size text'
    },
    levels = {
      'fail': {
        range: [0, 3],
        color: 'hsl(0, 100%, 40%)'
      },
      'aa-large': {
        range: [3, 4.5],
        color: 'hsl(40, 100%, 45%)'
      },
      'aa': {
        range: [4.5, 7],
        color: 'hsl(80, 60%, 45%)'
      },
      'aaa': {
        range: [7, 22],
        color: 'hsl(95, 60%, 41%)'
      }
    };

  function debounce(func, wait) {
    // we need to save these in the closure
    var timeout, args, context, timestamp;
    return function () {
      // save details of latest call
      context = this;
      args = [].slice.call(arguments, 0);
      timestamp = new Date();
      // this is where the magic happens
      var later = function () {
        // how long ago was the last call
        var last = (new Date()) - timestamp;
        // if the latest call was less that the wait period ago
        // then we reset the timeout to wait for the difference
        if (last < wait) {
          timeout = window.setTimeout(later, wait - last);
          // or if not we can null out the timer and run the latest
        } else {
          timeout = null;
          func.apply(context, args);
        }
      };
      // we only need to set the timer now if one isn't already running
      if (!timeout) {
        timeout = window.setTimeout(later, wait);
      }
    };
  }

  function isValidColor(colorStr) {
    var elm = $('#test-color')[0],
      oldValue = elm.style.backgroundColor;
    elm.style.background = colorStr;
    return elm.style.backgroundColor !== oldValue;
  }

  function rangeIntersect(min, max, upper, lower) {
    return (max < upper ? max : upper) - (lower < min ? min : lower);
  }

  function parseHashPath(hashPath) {
    var arr,
      colors = {
        background: 'white',
        text: 'black'
      };

    if (hashPath && hashPath.length > 0) {
      hashPath = hashPath.substr(1, hashPath.length - 1);
      arr = hashPath.split('-on-');
      if (arr[0]) {
        colors.text = arr[0];
      }
      if (arr[1]) {
        colors.background = arr[1];
      }
    }
    return colors;
  }

  function IndexCtrl($scope, $timeout, $location) {
    var self = this;

    self.updateColorsFromPath = function () {
      var colors = parseHashPath($location.path());
      self.backgroundColor = colors.background;
      self.textColor = colors.text;
    };

    self.updateColorsFromPath();

    window.onhashchange = function () {
      self.updateColorsFromPath();
      $scope.$apply(function () {
        self.notifyChange();
      });
    };

    self.notifyChange = function () {
      if (isValidColor(self.textColor) || isValidColor(self.backgroundColor)) {
        $location.path(self.textColor + '-on-' + self.backgroundColor);
        $scope.$broadcast(UPDATE_SCORE);
      }
    };

    self.updateScore = function (bgColor, textColor) {
      self.contrast = bgColor.contrast(textColor);
      var min = self.contrast.min,
        max = self.contrast.max,
        range = max - min,
        classes = [],
        percentages = [],
        level,
        bounds,
        lower,
        upper,
        i,
        stops,
        previousPercentage,
        info,
        color,
        percentage,
        gradient;

      for (level in levels) {
        if (levels.hasOwnProperty(level)) {
          bounds = levels[level].range;
          lower = bounds[0];
          upper = bounds[1];

          if (min < upper && max >= lower) {
            classes.push(level);

            percentages.push({
              level: level,
              percentage: 100 * rangeIntersect(min, max, upper, lower) / range
            });
          }
        }
      }

      self.ratioErrorExplain = {};
      if (self.contrast.error) {
        self.ratioErrorExplain.message = '±' + self.contrast.error;
        self.ratioErrorExplain.tooltip = min + ' - ' + max;
      }

      self.results = {};
      self.output = {};

      if (classes.length <= 1) {
        self.results.message = messages[classes[0]];
        self.output.backgroundImage = '';
        self.output.backgroundColor = levels[classes[0]].color;
      } else {
        self.results.message = messages.semitransparent;
        self.results.cases = [];

        for (i = 0; i < classes.length; i += 1) {
          self.results.cases.push(messages[classes[i]]);
        }

        // Create gradient illustrating levels
        stops = [];
        previousPercentage = 0;

        for (i = 0; i < 2 * percentages.length; i += 1) {
          info = percentages[i % percentages.length];
          level = info.level;
          color = levels[level].color;
          percentage = previousPercentage + info.percentage / 2;
          stops.push(color + ' ' + previousPercentage + '%', color + ' ' + percentage + '%');
          previousPercentage = percentage;
        }

        if (PrefixFree.functions.indexOf('linear-gradient') > -1) {
          // Prefixed implementation
          gradient = 'linear-gradient(-45deg, ' + stops.join(', ') + ')';
          self.output.backgroundImage = PrefixFree.prefix + gradient;
        } else {
          gradient = 'linear-gradient(135deg, ' + stops.join(', ') + ')';
          self.output.backgroundImage = gradient;
        }
      }

      self.output.classes = classes.join(' ');
    };

    self.swapColor = function () {
      var temp = this.backgroundColor;
      this.backgroundColor = this.textColor;
      this.textColor = temp;
      this.notifyChange();
    };

    self.colorPickerOptions = {
      preferredFormat: 'hex',
      showAlpha: true,
      clickoutFiresChange: true
    };

    $timeout(function () {
      self.notifyChange();
    });
  }
  IndexCtrl.$inject = ['$scope', '$timeout', '$location'];
  app.controller('IndexCtrl', IndexCtrl);

  // calc-color-score directive
  function calcColorScore($timeout) {
    return {
      link: function (scope, elm, attrs) {
        scope.$on(UPDATE_SCORE, function () {
          $timeout(function () {
            var bgColor = new Color(window.getComputedStyle(elm[0]).backgroundColor),
              textColor = new Color(window.getComputedStyle(elm[0]).color),
              callbackFn = scope.$eval(attrs.calcColorScore);
            callbackFn(bgColor, textColor);
            scope.$broadcast(UPDATE_FAV_ICON, bgColor, textColor);
          });
        });
      }
    };
  }
  calcColorScore.$inject = ['$timeout'];
  app.directive('calcColorScore', calcColorScore);

  // incrementable-text directive
  function incrementableText() {
    return {
      link: function (scope, elm) {
        /*jshint -W031 */
        var o = new Incrementable(elm[0]);
        o = null;
        /*jshint +W031 */
      }
    };
  }
  incrementableText.$inject = [];
  app.directive('incrementableText', incrementableText);

  // auto-length input
  function autoLength() {
    return {
      link: function (scope, elm) {
        if (elm.is('input')) {
          elm[0].oninput = function () {
            elm[0].style.width = elm[0].value.length * 0.56 + 'em';
            elm[0].style.width = elm[0].value.length + 'ch';
          };
        }
      }
    };
  }
  autoLength.$inject = [];
  app.directive('autoLength', autoLength);

  // favorite-icon directive
  function favoriteIcon() {
    return {
      link: function (scope, elm, attrs) {
        var document = window.document,
          canvas = document.createElement('canvas'),
          ctx = canvas.getContext('2d'),
          updateFavIcon = debounce(function (bgColor, textColor) {
            ctx.clearRect(0, 0, 16, 16);

            ctx.fillStyle = bgColor.toString();
            ctx.fillRect(0, 0, 8, 16);

            ctx.fillStyle = textColor.toString();
            ctx.fillRect(8, 0, 8, 16);

            elm.attr('href', canvas.toDataURL());
          }, 300);

        canvas.width = canvas.height = 16;
        document.body.appendChild(canvas);

        scope.$on(UPDATE_FAV_ICON, function (e, bgColor, textColor) {
          updateFavIcon(bgColor, textColor);
        });
      }
    };
  }
  favoriteIcon.$inject = [];
  app.directive('favoriteIcon', favoriteIcon);
}(window.PrefixFree, window.Color, window.Incrementable, window.$));