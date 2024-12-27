/* eslint no-restricted-properties: "off" */

const assert = require('node:assert');
const R = require('../source/index.js');

/**
 * map :: Functor f => (a -> b) -> f a -> f b
 */
const map = R.curry((fn, functor) => new Iterator(function* () {
  for (const i of functor) {
    yield fn(i);
  }
}));

/**
 * filter :: Filterable f => (a -> Boolean) -> f a -> f a
 */
const filter = R.curry((fn, it) => new Iterator(function* () {
  for (const i of it) {
    if (fn(i)) {
      yield i;
    }
  }
}));

/**
 * chain :: Chain m => (a -> m b) -> m a -> m b
 */
const chain = R.curry((fn, its) => new Iterator(function* () {
  for (const it of its) {
    for (const i of fn(it)) {
      yield i;
    }
  }
}));

/**
 * reduce :: Foldable f => ((a, b) -> a) -> a -> [f b] -> a
 */
const reduce = R.curry((fn, acc, it) => {
  for (const i of it) {
    acc = fn(acc, i);
  }

  return acc;
});

const Iterator = function(fn) {
  this[Symbol.iterator] = fn;
};

Iterator.prototype.map =
Iterator.prototype['fantasy-land/map'] =
function(fn) {
  return map(fn, this);
};

Iterator.prototype.filter =
Iterator.prototype['fantasy-land/filter'] =
function(pred) {
  return filter(pred, this);
};

Iterator.prototype.chain =
Iterator.prototype['fantasy-land/chain'] =
function(fn) {
  return chain(fn, this);
};

Iterator.prototype.reduce =
Iterator.prototype['fantasy-land/reduce'] =
function(fn, acc) {
  return reduce(fn, acc, this);
};

Iterator.of = function(...args) {
  if (args.length === 1) {
    if (typeof args[0][Symbol.iterator] === 'function') {
      return new Iterator(function* () {
        for (const x of args[0]) {
          yield x;
        }
      });
    }
  }
};

describe.only('Iterator', function() {
  it('R.map :: Functor f => (a -> b) -> f a -> f b', function() {
    const it = Iterator.of([1, 2, 3]);
    const actual = Array.from(R.map(R.add(1), it));
    assert.deepStrictEqual(actual, [2, 3, 4]);
  });

  it('R.filter :: Filterable f => (a -> Boolean) -> f a -> f a', function() {
    const it = Iterator.of([1, 2, 3]);
    const actual = Array.from(R.filter(x => x % 2 === 1, it));
    assert.deepStrictEqual(actual, [1, 3]);
  });

  it('R.chain :: Chain m => (a -> m b) -> m a -> m b', function() {
    const it = Iterator.of([1, 2, 3]);
    const actual = Array.from(R.chain(x => Iterator.of(Array(x).fill(x)), it));
    assert.deepStrictEqual(actual, [1, 2, 2, 3, 3, 3]);
  });

  it('R.reduce :: Foldable f => ((a, b) -> a) -> a -> [f b] -> a', function() {
    const it = Iterator.of([1, 2, 3]);
    const actual = R.reduce(R.add, 0, it);
    assert.deepStrictEqual(actual, 6);
  });
});
