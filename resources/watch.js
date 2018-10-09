/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import sane from 'sane';
import { join as joinPath, resolve as resolvePath } from 'path';
import { spawn } from 'child_process';

process.env.PATH += ':./node_modules/.bin';

var cmd = resolvePath(__dirname);
// process.chdir(resolvePath(cmd, '..'));
var srcDir = 'src/';
var libDir = 'lib/';
var testsDir = '__tests__';

function exec(command, options) {
  return new Promise((resolve, reject) => {
    var child = spawn(command, options, {
      cmd: cmd,
      env: process.env,
      stdio: 'inherit'
    });
    child.on('exit', code => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error('Error code: ' + code));
      }
    });
  });
}

var watcher = sane(srcDir, { glob: ['**/*.js', '**/*.graphql'] })
  .on('ready', startWatch)
  .on('add', changeFile)
  .on('delete', deleteFile)
  .on('change', changeFile);

var watcher = sane(testsDir, { glob: ['**/*.js', '**/*.graphql'] })
  .on('ready', startWatch)
  .on('add', changeFile)
  .on('delete', deleteFile)
  .on('change', changeFile);

process.on('SIGINT', () => {
  console.log(CLEARLINE + yellow(invert('stopped watching')));
  watcher.close();
  process.exit();
});

var isChecking;
var needsCheck;
var toCheck = {};
var timeout;

function startWatch() {
  process.stdout.write(CLEARSCREEN + green(invert('watching...')));
}

function changeFile(filepath, root, stat) {
  if (!stat.isDirectory()) {
    toCheck[filepath] = true;
    debouncedCheck();
  }
}

function deleteFile(filepath) {
  delete toCheck[filepath];
  debouncedCheck();
}

function debouncedCheck() {
  needsCheck = true;
  clearTimeout(timeout);
  timeout = setTimeout(guardedCheck, 250);
}

function guardedCheck() {
  if (isChecking || !needsCheck) {
    return;
  }
  isChecking = true;
  var filepaths = Object.keys(toCheck);
  toCheck = {};
  needsCheck = false;
  checkFiles(filepaths).then(() => {
    isChecking = false;
    process.nextTick(guardedCheck);
  });
}

function checkFiles(filepaths) {
  console.log('\u001b[2J');

  console.log('Here we come');
  return Promise.resolve()
    .then(() => runTests(filepaths))
    .then(testSuccess => lintFiles(filepaths)
        .then(lintSuccess =>
          testSuccess && lintSuccess))
    .catch(() => false)
    .then(success => {
      process.stdout.write(
        '\n' + (success ? '' : '\x07') + green(invert('watching...'))
      );
    });
}

function runTests(filepaths) {
  console.log('Running tests\n');
  return exec('yarn', ['run', 'test']).catch(() => false);
}

function lintFiles(filepaths) {
  console.log('Linting Code\n');

  return filepaths.reduce((prev, filepath) => prev.then(prevSuccess => {
    if (isJS(filepath)) {
      process.stdout.write('  ' + filepath + ' ...');
      return exec('eslint', [srcPath(filepath)])
        .catch(() => false)
        .then(success => {
          console.log(CLEARLINE + '  ' + (success ? CHECK : X)
            + ' ' + filepath);
          return prevSuccess && success;
        });
    }
    return prevSuccess;
  }), Promise.resolve(true));
}

// Filepath
function srcPath(filepath) {
  return joinPath(srcDir, filepath);
}

// Predicates
function isJS(filepath) {
  return filepath.indexOf('.js') === filepath.length - 3;
}

function allTests(filepaths) {
  return filepaths.length > 0 && filepaths.every(isTest);
}

var TEST_PATH_RX = /^(?:.*?\/)?__tests__\/.+?-test\.js$/;

function isTest(filepath) {
  return TEST_PATH_RX.test(filepath);
}

// Print helpers

var CLEARSCREEN = '\u001b[2J';
var CLEARLINE = '\r\x1B[K';
var CHECK = green('\u2713');
var X = red('\u2718');

function invert(str) {
  return `\u001b[7m ${str} \u001b[27m`;
}

function red(str) {
  return `\x1B[K\u001b[1m\u001b[31m${str}\u001b[39m\u001b[22m`;
}

function green(str) {
  return `\x1B[K\u001b[1m\u001b[32m${str}\u001b[39m\u001b[22m`;
}

function yellow(str) {
  return `\x1B[K\u001b[1m\u001b[33m${str}\u001b[39m\u001b[22m`;
}
