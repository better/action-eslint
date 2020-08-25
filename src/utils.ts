import * as core from '@actions/core';

/*
 * Borrowed from actions/cache on Github
 * https://github.com/actions/cache/blob/eed9cfe64d00dd64cbb36bec915d41dd6fab9f6c/src/utils/actionUtils.ts#L49
 */
export function getInputAsArray(
  name: string,
  options?: core.InputOptions
): string[] {
  return core
    .getInput(name, options)
    .split('\n')
    .map(s => s.trim())
    .filter(x => x !== '');
}
