"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const getChangedLinesFromHunk = (hunk) => {
    let lineNumber = 0;
    return hunk.reduce((accum, line) => {
        if (line.startsWith('@@')) {
            lineNumber = Number(line.match(/\+([0-9]+)/)[1]);
        }
        else if (!line.startsWith('-')) {
            if (line.startsWith('+') && lineNumber !== 0) {
                accum.push(lineNumber);
            }
            lineNumber++;
        }
        return accum;
    }, []);
};
const getHunksFromDiff = (str) => {
    const lines = str.split('\n');
    const hunks = [];
    let i = -1;
    for (const line of lines) {
        if (line.startsWith('diff --git')) {
            i++;
            hunks[i] = [];
        }
        hunks[i].push(line);
    }
    return hunks;
};
exports.getChangedLinesByFilepath = (diff) => {
    const changedLinesByFile = new Map();
    for (const hunk of getHunksFromDiff(diff)) {
        const file = hunk[0].split(' ')[3].substring(2);
        changedLinesByFile.set(file, new Set(getChangedLinesFromHunk(hunk.slice(4))));
    }
    return changedLinesByFile;
};
