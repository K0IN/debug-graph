import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const launchArgs = [
      '--disable-gpu',
      '--disable-extensions',
      '--disable-workspace-trust',
      '--install-extension=ms-python.debugpy',
      '--install-extension=ms-python.python',
    ];
    // Download VS Code, unzip it and run the integration test
    await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs, version: 'stable' });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
