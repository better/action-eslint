import path from 'path';

import exec from 'execa';
import { CLIEngine } from 'eslint';
import {
  T, assoc, cond, curry, curryN, endsWith, evolve, equals, filter, find, length,
  map, merge, objOf, pipe, pipeP, pluck, prop, propEq, split, sum, tap,
} from 'ramda';

import { EXTENSIONS_TO_LINT } from './constants';
import { getChangedLinesFromDiff } from './git';

const linter = new CLIEngine({ extensions: [...EXTENSIONS_TO_LINT] });
const formatter = linter.getFormatter();

const ESLINT_TO_GITHUB_LEVELS: import('@octokit/rest').ChecksUpdateParamsOutputAnnotations['annotation_level'][] = [
  'notice', 'warning', 'failure'
];

const getChangedFiles = pipeP(
  commitRange => exec('git', ['diff', commitRange, '--name-only', '--diff-filter=ACM']),
  prop('stdout'),
  split('\n'),
  filter(endsWith('.js')),
  map(path.resolve)
);

const getDiff = curry((commitRange, filename) => {
  return exec('git', ['diff', commitRange, filename])
    .then(prop('stdout'));
});

const getChangedFileLineMap = curry((commitRange, filePath) => pipeP(
  getDiff(commitRange),
  getChangedLinesFromDiff,
  objOf('changedLines'),
  assoc('filePath', filePath)
)(filePath));

const lintChangedLines = pipe(
  map(prop('filePath')),
  linter.executeOnFiles.bind(linter)
);

const filterLinterMessages = changedFileLineMap => (linterOutput) => {
  const filterMessagesByFile = (result) => {
    const fileLineMap = find(propEq('filePath', result.filePath), changedFileLineMap);
    const changedLines = prop('changedLines', fileLineMap);

    const filterMessages = evolve({
      messages: filter(message => changedLines.includes(message.line)),
    });

    return filterMessages(result);
  };

  const countBySeverity = (severity) => {
    return pipe(
      filter(propEq('severity', severity)),
      length
    );
  }

  const countWarningMessages = countBySeverity(1)
  const countErrorMessages = countBySeverity(2)

  const warningCount = (result) => {
    const transform = {
      warningCount: countWarningMessages(result.messages),
    };
    return merge(result, transform);
  }

  const errorCount = (result) => {
    const transform = {
      errorCount: countErrorMessages(result.messages),
    };
    return merge(result, transform);
  }

  return pipe(
    prop('results'),
    map(pipe(
      filterMessagesByFile,
      warningCount,
      errorCount
    )),
    objOf('results')
  )(linterOutput);
};

const applyLinter = changedFileLineMap => pipe(
  lintChangedLines,
  filterLinterMessages(changedFileLineMap)
)(changedFileLineMap);

const logResults = pipe(
  prop('results'),
  formatter,
  console.log
);

const getErrorCountFromReport = pipe(
  prop('results'),
  pluck('errorCount'),
  sum
);

const exitProcess = curryN(2, n => process.exit(n));

const reportResults = pipe(
  tap(logResults),
  getErrorCountFromReport,
  cond([
    [equals(0), exitProcess(0)],
    [T, exitProcess(1)],
  ])
);

const buildAnnotations = (eslintResults, filesList) => {
  const annotations: import('@octokit/rest').ChecksUpdateParamsOutputAnnotations[] = [];
  for (const result of eslintResults) {
    const { filePath, messages } = result;
    const filename = filesList.find(file => filePath.endsWith(file));
    if (!filename) continue;

    for (const msg of messages) {
      const { line, severity, ruleId, message, endLine, column, endColumn } = msg;
      annotations.push({
        path: filename,
        start_line: line || 0,
        end_line: endLine || line || 0,
        start_column: column || 0,
        end_column: endColumn || column || 0,
        annotation_level: ESLINT_TO_GITHUB_LEVELS[severity],
        title: ruleId || 'ESLint',
        message
      });
    }
  }

  return annotations;
};

export async function eslint(filesList: string[]) {
  const cli = new CLIEngine({ extensions: [...EXTENSIONS_TO_LINT] });
  const report = cli.executeOnFiles(filesList);
  // fixableErrorCount, fixableWarningCount are available too
  const { results, errorCount, warningCount } = report;

  const annotations = buildAnnotations(results, filesList);
  const conclusion = errorCount > 0
      ? 'failure'
      : 'success' as import('@octokit/rest').ChecksCreateParams['conclusion'];

  return {
    conclusion: conclusion,
    output: {
      title: `${errorCount} error(s), ${warningCount} warning(s) found in ${filesList.length} file(s)`,
      summary: `${errorCount} error(s), ${warningCount} warning(s) found in ${filesList.length} file(s)`,
      annotations
    }
  };
};

const lintDiff = (commitRange = 'HEAD') => {
  getChangedFiles()
    .map(getChangedFileLineMap(commitRange))
    .then(applyLinter)
    .then(reportResults);
};

export default lintDiff;
