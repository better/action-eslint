"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const getChangedLinesFromHunk = (hunk) => {
    let lineNumber = 0;
    const changedLines = [];
    for (const line of hunk) {
        if (line.startsWith('@@')) {
            lineNumber = Number(line.match(/\+([0-9]+)/)[1]);
            continue;
        }
        if (!line.startsWith('-')) {
            if (line.startsWith('+') && lineNumber != 0) {
                changedLines.push(lineNumber);
            }
            lineNumber++;
        }
    }
    return changedLines;
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
