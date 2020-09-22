import * as path from 'path';

import { ChecksUpdateParamsOutputAnnotations } from '@octokit/rest';

import { EXTENSIONS_TO_LINT } from './constants';

import { getChangedLinesByFilepath } from './git'

const ESLINT_TO_GITHUB_LEVELS: ChecksUpdateParamsOutputAnnotations['annotation_level'][] = [
  'notice',
  'warning',
  'failure'
];
// https://developer.github.com/v3/checks/runs/#output-object
const ANNOTATION_LIMIT = 50

const buildAnnotation = (filename, msg) => {
  const { line, endLine, severity, ruleId, message } = msg;
  let annotation = {
    path: filename,
    start_line: line || 0,
    end_line: endLine || line || 0,
    annotation_level: ESLINT_TO_GITHUB_LEVELS[severity],
    title: ruleId || 'ESLint',
    message
  };

  return annotation;
};

export async function eslint(filesList: string[], diff: string) {
  const { CLIEngine } = (await import(
    path.join(process.cwd(), 'node_modules/eslint')
  )) as typeof import('eslint');

  const cli = new CLIEngine({ extensions: [...EXTENSIONS_TO_LINT] });
  const report = cli.executeOnFiles(filesList);
  // fixableErrorCount, fixableWarningCount are available too
  const { results, errorCount, warningCount } = report;

  console.log(filesList)
  console.log(diff)
  const changedLinesByFilepath = getChangedLinesByFilepath(diff)
  console.log(changedLinesByFilepath)

  const annotations: ChecksUpdateParamsOutputAnnotations[] = [];
  for (const result of results) {
    const { filePath, messages } = result;
    const filename = filesList.find(file => filePath.endsWith(file));
    if (!filename) continue;

    for (const msg of messages) {
      if (annotations.length >= ANNOTATION_LIMIT) break;
      console.log(msg);
      for (let lineNumber = msg.line; lineNumber <= msg.endLine; lineNumber++)
      {
        if (changedLinesByFilepath.get(filePath)?.has(lineNumber)) {
          console.log(`startLine: ${msg.line}`)
          console.log(`endLine: ${msg.endLine}`)
          const annotation = buildAnnotation(filename, msg);
          annotations.push(annotation);
          break;
        }
      }
    }
  }

  return {
    conclusion: (errorCount > 0
      ? 'failure'
      : 'success') as import('@octokit/rest').ChecksCreateParams['conclusion'],
    output: {
      title: `${errorCount} error(s), ${warningCount} warning(s) found in ${filesList.length} file(s)`,
      summary: `${errorCount} error(s), ${warningCount} warning(s) found in ${filesList.length} file(s)`,
      annotations
    }
  };
}
