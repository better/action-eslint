import * as path from 'path';

import * as core from '@actions/core';
import * as github from '@actions/github';

import { CHECK_NAME, EXTENSIONS_TO_LINT } from './constants';
import { eslint } from './eslint-cli';
import lintDiff from './lint-diff';

const octokit = new github.GitHub(
  core.getInput('repo-token', { required: true })
);

/**
 * This is just for syntax highlighting, does nothing
 * @param {string} s
 */
const gql = (s: TemplateStringsArray): string => s.join('');

const getPRinfo = async (context) => {
  return octokit.graphql(
    gql`
      query($owner: String!, $name: String!, $prNumber: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $prNumber) {
            files(first: 100) {
              nodes {
                path
              }
            }
            commits(last: 1) {
              nodes {
                commit {
                  oid
                }
              }
            }
          }
        }
      }
    `,
    {
      owner: context.repo.owner,
      name: context.repo.repo,
      prNumber: context.issue.number,
    }
  );
};

const getGitContext = async () => {
  const context = github.context;

  const prInfo = await getPRinfo(context);
  const pullRequest = prInfo!.repository.pullRequest;
  const currentSha = pullRequest.commits.nodes[0].commit.oid;
  const files = pullRequest.files.nodes;

  return { context, currentSha, files };
};

const getCheckId = async (context, currentSha) => {
  let checkId;
  const checkName = core.getInput('check-name');

  if (checkName) {
    const checks = await octokit.checks.listForRef({
      ...context.repo,
      status: 'in_progress',
      ref: currentSha,
    });

    const matchedCheck = checks.data.check_runs.find(({ name }) => name === checkName);
    if (matchedCheck) checkId = matchedCheck.id;
  }

  if (!checkId) {
    const checkObject = await octokit.checks.create({
      ...context.repo,
      name: CHECK_NAME,
      head_sha: currentSha,
      status: 'in_progress',
      started_at: new Date().toISOString()
    });
    checkId = checkObject.data.id;
  }

  return checkId;
};

async function run() {
  const { context, currentSha, files } = await getGitContext();

  const filesToLint = files
    .filter(f => EXTENSIONS_TO_LINT.has(path.extname(f.path)))
    .map(f => f.path);

  if (filesToLint.length < 1) {
    const extensions = [...EXTENSIONS_TO_LINT].join(', ');
    console.warn(
      `No files with [${extensions}] extensions modified in this PR, nothing to lint`
    );
    return;
  }

  const checkId = await getCheckId(context, currentSha);

  try {
    const diffResults = lintDiff(currentSha); // TODO: pass commit range
    const { conclusion, output } = await eslint(filesToLint);

    await octokit.checks.update({
      ...context.repo,
      check_run_id: checkId,
      completed_at: new Date().toISOString(),
      conclusion,
      output,
    });

    if (conclusion === 'failure') {
      core.setFailed('ESLint found some errors');
    }
  } catch (error) {
    await octokit.checks.update({
      ...context.repo,
      check_run_id: checkId,
      conclusion: 'failure',
      completed_at: new Date().toISOString(),
    });
    core.setFailed(error.message);
  }
}

run();
