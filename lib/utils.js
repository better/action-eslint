"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
/*
 * Borrowed from actions/cache on Github
 * https://github.com/actions/cache/blob/eed9cfe64d00dd64cbb36bec915d41dd6fab9f6c/src/utils/actionUtils.ts#L49
 */
function getInputAsArray(name, options) {
    return core
        .getInput(name, options)
        .split('\n')
        .map(s => s.trim())
        .filter(x => x !== '');
}
exports.getInputAsArray = getInputAsArray;
