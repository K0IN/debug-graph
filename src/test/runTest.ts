import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const launchArgs = [
      '--verbose',
      '--disable-workspace-trust',
      '--install-extension=ms-python.debugpy',
      '--install-extension=ms-python.python',
    ] as string[];

    await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs, version: 'stable' });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
