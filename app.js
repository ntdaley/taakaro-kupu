/**
 * Copyright 2017 Nicholas Daley
 * https://github.com/ntdaley/taakaro-kupu/
 * License: MIT
 */
 /* global Audio, localStorage */
'use strict';
angular
.module('kupu', ['ngAnimate', 'ngMaterial', 'word-list'])
.filter('time', function() {
  return function(seconds) {
    function zeroPad(n, digits) {
      var result = String(n);
      while( result.length < (digits || 2 ) ) {
        result = '0' + result;
      }
      return result;
    }
    return Math.floor(seconds / 60) + ':' + zeroPad(seconds % 60);
  };
})
.run(function($window) {
  $window.addEventListener('beforeunload', function(e) {
    var message = 'Ka kite anō';
    e.returnValue = message;
    return message;
  });
})
.factory('sounds', function($rootScope) {
  var soundFiles = {
    tick : new Audio('sounds/tick.mp3'),
    tock : new Audio('sounds/tock.mp3'),
    gameOver : new Audio('sounds/351565__bertrof__game-sound-incorrect-organic-violin.mp3'),
    correctWord : new Audio('sounds/335908__littlerainyseasons__correct.mp3'),
    incorrectWord : new Audio('sounds/131657__bertrof__game-sound-wrong.mp3'),
    goalReached : new Audio('sounds/335586__littlerainyseasons__warning.mp3')
  };

  var sounds = {
    play : function(soundId) {
      if( !sounds.mute ) {
        soundFiles[soundId].play();
      }
    }
  };
  sounds.mute = JSON.parse(localStorage.getItem('mute')) || false;
  $rootScope.$watch(function() {
    return sounds.mute;
  }, function(newVal) {
    localStorage.setItem('mute', newVal);
  });

  return sounds;
})
.controller('KupuCtrl', function($timeout, $interval, $window, $scope, wordList, syllableWeightings, sounds) {
  var ctrl = this;
  var idIndex = 0;
  ctrl.score = 0;
  ctrl.timeRemaining = 180;
  ctrl.moreTimeCost=50;
  ctrl.nextMoreTimeScore=50;
  ctrl.sounds = sounds;

  $scope.$watch(function() {
    return ctrl.score;
  }, function(newValue) {
    if( newValue >= ctrl.nextMoreTimeScore ) {
      sounds.play('goalReached');
      ctrl.timeRemaining += 60;
      ctrl.moreTimeCost += 10;
      ctrl.nextMoreTimeScore += ctrl.moreTimeCost;
      ctrl.message2 = 'Wh\u0101inga tutuki: w\u0101 atu'; //goal achieved: more time
    }
  });

  var timer = null;

  function stopTimer() {
    if( timer ) {
      $interval.cancel( timer );
      timer = null;
    }
  }

  function gameOver() {
    stopTimer();
    sounds.play('gameOver');
  }
  function startTimer() {
    if( !timer ) {
      timer = $interval(function() {
        ctrl.timeRemaining-=1;
        if( ctrl.timeRemaining <= 0 ) {
          gameOver();
        } else if( ctrl.timeRemaining <= 10 ) {
          if( ctrl.timeRemaining % 2 === 0) {
            sounds.play('tick');
          } else {
            sounds.play('tock');
          }
        }
      }, 1000);
    }
  }
  startTimer();

  ctrl.highScore = parseInt($window.localStorage.getItem('highScore'), 10) || 0;
  $scope.$watch(function() {
    return ctrl.score;
  }, function(newValue) {
    if( newValue > ctrl.highScore ) {
      ctrl.highScore = ctrl.score;
      $window.localStorage.setItem('highScore', newValue);
    }
  });

  ctrl.isPaused = true;
  $scope.$watch(function() {
    return ctrl.isPaused;
  }, function(isPaused) {
    if( isPaused ) {
      stopTimer();
    } else {
      startTimer();
    }
  });

  $window.addEventListener('blur', function() {
    ctrl.isPaused = true;
  });

  function repeat(n, fn) {
    var result = [];
    for(var i = 0; i < n; i++) {
      result.push(fn(i));
    }
    return result;
  }

  var randomEntry = function(entries, weightings) {
    var totalWeight = entries.reduce(function(sum, e) {
      return sum + (weightings[e] || 0);
    }, 0);
    var n = Math.random() * totalWeight;
    return entries.find(function(e) {
      n -= weightings[e];
      return n < 0;
    });
  };

  ctrl.vowels = [
    'a', '\u0101', 'e', '\u0113', 'i', '\u012b', 'o', '\u014d', 'u', '\u016b'
  ];
  ctrl.consonants = [
    'h', 'k', 'm', 'n', 'p', 'r', 't', 'w', 'wh', 'ng'
  ];
  ctrl.alphabet = ctrl.vowels.concat(ctrl.consonants);

  ctrl.syllables = ctrl.vowels.concat(
    ctrl.consonants.map(function(c) {
      return ctrl.vowels.map(function(v) {
        return c + v;
      });
    }).reduce(function(l, l2) {return l.concat(l2);}, [])
  );

  var randomCell = function() {
    idIndex += 1;
    return {
      text : randomEntry(ctrl.syllables, syllableWeightings),
      id : idIndex
    };
  };

  ctrl.grid = repeat(10, function() {
    return repeat(10, randomCell);
  });

  var selectedWord = [];
  ctrl.selectedWordText = function() {
    return selectedWord.map( function(c) {
      return c.cell.text;
    }).join('');
  };
  ctrl.isSelected = function(cell) {
    // console.log('isSelected', arguments);
    return selectedWord.some(function(c) {
      return c.cell === cell;
    });
  };
  ctrl.isLastSelected = function(cell) {
    // console.log('isLastSelected', arguments);
    var lastCell = selectedWord[selectedWord.length - 1];
    return lastCell && lastCell.cell === cell;
  };
  var isAdjacent = function(a, b) {
    var rowDifference = Math.abs(a.rowIndex - b.rowIndex);
    var colDifference = Math.abs(a.colIndex - b.colIndex);
    // console.log('isAdjacent', arguments, rowDifference, colDifference);
    return (rowDifference === 1 || colDifference == 1) &&
           (rowDifference === 0 || rowDifference === 1) &&
           (colDifference === 1 || colDifference === 0);
  };


  $scope.$watch(function() {
    return ctrl.timeRemaining;
  }, function(newValue) {
    if( newValue <= 0 ) {
      selectedWord = [];
      ctrl.message2 = 'K\u0113mu ki runga'; //game over
      ctrl.isPaused = true;
    }
  });

  ctrl.newGame = function() {
    $window.location.reload();
  };
  ctrl.clicked = function(column, cell) {
    if( ctrl.timeRemaining <= 0 ) {
      //can't play after timeout.
      return;
    }
    ctrl.message = '';
    ctrl.message2 = '';
    ctrl.messageLink = '';
    var colIndex = ctrl.grid.findIndex(function(c) {
      return c===column;
    });
    var rowIndex = ctrl.grid[colIndex].findIndex(function(c) {
      return c=== cell;
    });
    var newCell = {
      rowIndex : rowIndex,
      colIndex : colIndex,
      cell : cell
    };
    var cellIndex = selectedWord.findIndex(function(c) {
      return c.rowIndex === rowIndex && c.colIndex === colIndex;
    });
    var lastCell = selectedWord[selectedWord.length - 1];
    if(cellIndex >= 0 && cellIndex === selectedWord.length - 1) {
      //selecting the last cell deselects it
      selectedWord.splice(selectedWord.length - 1, 1);
      return;
    } else if( cellIndex >= 0) {
      //selecting a different selected cell deselcts all cells after it
      selectedWord.splice(cellIndex + 1, selectedWord.length);
      return;
    } else if( selectedWord.length === 0 || isAdjacent(lastCell, newCell ) ) {
      //can select any cell first, or any cell adjacent to the last cell
      selectedWord.push(newCell);
      return;
    } else {
      //can't select/deselect cell that's not adjacent to last cell.
      return;
    }
  };

  ctrl.message = '';
  ctrl.message2 = '';
  ctrl.messageLink = '';
  ctrl.foundWords = [];
  var wordToScore = function(word) {
    return (word.length - 1) * word.length;
  };
  ctrl.consumeWord = function() {
    var text = ctrl.selectedWordText();
    var score = wordToScore(selectedWord);
    if( !wordList[text] ) {
      sounds.play('incorrectWord');
      ctrl.message = 'Kupu kore i kitea!'; //word not found
    } else {
      sounds.play('correctWord');
      ctrl.foundWords.push({ text : text, score : score });
      selectedWord.forEach(function(c) {
        var column = ctrl.grid[c.colIndex];
        column.push(randomCell());
      });
      $timeout(function() {
        selectedWord.forEach(function(c) {
          var column = ctrl.grid[c.colIndex];
          var r = column.findIndex(function(c2) {
            return c2.id === c.cell.id;
          });
          column.splice(r, 1);
        });
        selectedWord = [];
      }, 100);
      ctrl.score += score;
      ctrl.message = 'Kupu i kitea: ' + text; //word found:
      ctrl.messageLink = 'http://maoridictionary.co.nz/search?idiom=&phrase=&proverb=&loan=&histLoanWords=&keywords=' +
                         text;
    }
  };

})
;
