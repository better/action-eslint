import {
  addIndex, complement, curry, defaultTo, filter, flatten, insert, isEmpty,
  map, pipe, reduce, slice, split, startsWith, uniq,
} from 'ramda';

/* Helper functions */
const mapIndexed = addIndex(map);
const reduceIndexed = addIndex(reduce);

const firstItemStartsWith = curry((prefix, list) => startsWith(prefix, list[0]));
const doesNotStartWith = complement(startsWith);

const splitEveryTime = curry((predicate, list) => {
  const splitIndexes = pipe(
    reduceIndexed((acc, item, index) => {
      if (predicate(item)) {
        return [...acc, index];
      }

      return acc;
    }, []),
    insert(list.length - 1, list.length)
  )(list);

  const split = mapIndexed((splitIndex, i, splitIndexList) => {
    const previousIndex = defaultTo(0, splitIndexList[i - 1]);
    const currentIndex = splitIndexList[i];

    return slice(previousIndex, currentIndex, list);
  });

  return pipe(
    split,
    filter(complement(isEmpty))
  )(splitIndexes);
});

/* Main functions */
const getChangedLinesFromHunk = (hunk) => {
  let lineNumber = 0

  return hunk.reduce((changedLines, line) => {
    if (startsWith('@@', line)) {
      lineNumber = Number(line.match(/\+([0-9]+)/)[1]) - 1
      return changedLines
    }

    if (doesNotStartWith('-', line)) {
      lineNumber += 1

      if (startsWith('+', line)) {
        return [...changedLines, lineNumber]
      }
    }

    return changedLines
  }, [])
};

const getHunksFromDiff = pipe(
  split('\n'),
  splitEveryTime(startsWith('@@')),
  filter(firstItemStartsWith('@@'))
);

export const getChangedLinesFromDiff = pipe(
  getHunksFromDiff,
  map(getChangedLinesFromHunk),
  flatten,
  uniq
);
