/* eslint no-restricted-properties: "off" */

const assert = require('node:assert');
const R = require('../source/index.js');

const isTransformer =
  obj =>
    obj != null && typeof obj['@@transducer/step'] === 'function';

const step = function(xf, fn) {
  return {
    '@@transducer/init': xf['@@transducer/init'],
    '@@transducer/result': xf['@@transducer/result'],
    '@@transducer/step': fn
  };
};

/**
 * map :: Functor f => (a -> b) -> f a -> f b
 */
const map = R.curry((fn, functor) =>
  isTransformer(functor)
    ? step(functor, (acc, x) => functor['@@transducer/step'](acc, fn(x)))
    : new AsyncIterator(async function* () {
      for await (const i of functor) {
        yield fn(i);
      }
    })
);

/**
 * filter :: Filterable f => (a -> Boolean) -> f a -> f a
 */
const filter = R.curry((pred, it) =>
  isTransformer(it)
    ? step(it, (acc, x) => pred(x) ? it['@@transducer/step'](acc, x) : acc)
    : new AsyncIterator(async function* () {
      for await (const i of it) {
        if (pred(i)) {
          yield i;
        }
      }
    })
);

/**
 * chain :: Chain m => (a -> m b) -> m a -> m b
 */
const chain = R.curry((fn, its) =>
  isTransformer(its)
    ? step(its, async(acc, x) => fn(x).reduce(its['@@transducer/step'], await acc))
    : new AsyncIterator(async function* () {
      for await (const it of its) {
        for await (const i of fn(it)) {
          yield i;
        }
      }
    })
);

/**
 * reduce :: Foldable f => ((a, b) -> a) -> a -> [f b] -> a
 */
const reduce = R.curry(async(fn, acc, it) => {
  for await (const i of it) {
    acc = fn(acc, i);
  }

  return acc;
});

/**
 * reducer :: (a, b) -> a
 * transformer :: reducer -> reducer
 * transduce :: (c -> c) -> ((a, b) -> a) -> a -> [b] -> a
 */
const transduce = R.curry(async(fn, reducer, init, it) => {
  const xf = fn({
    '@@transducer/init': () => init,
    '@@transducer/step': (acc, x) => reducer(acc, x),
    '@@transducer/result': R.identity
  });

  const acc = await it.reduce(xf['@@transducer/step'], xf['@@transducer/init']());
  return xf['@@transducer/result'](acc);
});

const AsyncIterator = function(fn) {
  this[Symbol.asyncIterator] = fn;
};

AsyncIterator.of = function(...args) {
  if (args.length === 1) {
    if (typeof args[0][Symbol.iterator] === 'function') {
      return new AsyncIterator(async function* () {
        for (const x of args[0]) {
          yield x;
        }
      });
    } else if (typeof args[0][Symbol.asyncIterator] === 'function') {
      return new AsyncIterator(async function* () {
        for (const x of args[0]) {
          yield x;
        }
      });
    }
  }
};

AsyncIterator.prototype.map =
AsyncIterator.prototype['fantasy-land/map'] =
function(fn) {
  return map(fn, this);
};

AsyncIterator.prototype.filter =
AsyncIterator.prototype['fantasy-land/filter'] =
function(pred) {
  return filter(pred, this);
};

AsyncIterator.prototype.chain =
AsyncIterator.prototype['fantasy-land/chain'] =
function(fn) {
  return chain(fn, this);
};

AsyncIterator.prototype.reduce =
AsyncIterator.prototype['fantasy-land/reduce'] =
function(fn, acc) {
  return reduce(fn, acc, this);
};

AsyncIterator.prototype.transduce = function(fn, reducer, init) {
  return transduce(fn, reducer, init, this);
};

describe.only('AsyncIterator', function() {
  it('R.map :: Functor f => (a -> b) -> f a -> f b', async function() {
    const it = AsyncIterator.of([1, 2, 3]);
    const actual = await Array.fromAsync(R.map(R.add(1), it));
    assert.deepStrictEqual(actual, [2, 3, 4]);
  });

  it('R.filter :: Filterable f => (a -> Boolean) -> f a -> f a', async function() {
    const it = AsyncIterator.of([1, 2, 3]);
    const actual = await Array.fromAsync(R.filter(x => x % 2 === 1, it));
    assert.deepStrictEqual(actual, [1, 3]);
  });

  it('R.chain :: Chain m => (a -> m b) -> m a -> m b', async function() {
    const it = AsyncIterator.of([1, 2, 3]);
    const actual = await Array.fromAsync(R.chain(x => AsyncIterator.of(Array(x).fill(x)), it));
    assert.deepStrictEqual(actual, [1, 2, 2, 3, 3, 3]);
  });

  it('R.reduce :: Foldable f => ((a, b) -> a) -> a -> [f b] -> a', async function() {
    const it = AsyncIterator.of([1, 2, 3]);
    const actual = await R.reduce(R.add, 0, it);
    assert.deepStrictEqual(actual, 6);
  });

  it('transduce :: (c -> c) -> ((a, b) -> a) -> a -> [b] -> a', async function() {
    const fn = R.compose(
      map(R.multiply(3)),
      filter(x => x % 2 === 1),
      map(R.add(-1)),
      chain(x => AsyncIterator.of(Array(x).fill(x)))
    );

    const it = AsyncIterator.of([1, 2, 3, 4]);
    const actual = await it.transduce(fn, R.flip(R.append), []);
    assert.deepStrictEqual(actual, [2, 2, 8, 8, 8, 8, 8, 8, 8, 8]);
  });
});
