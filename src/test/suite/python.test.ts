import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';
import { getStacktraceInfo } from '../../debug/callstack-extractor';
import { getCurrentValueForPosition } from '../../inspect';
import { executeWithBreakpoints } from './execute-helper';
import { validateStacktraceInfo } from './validators';

suite('Test python compatibility', function () {
  this.timeout(60_000);

  this.beforeAll(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('workbench.extensions.installExtension', 'ms-python.debugpy');
    await vscode.commands.executeCommand('workbench.extensions.installExtension', 'ms-python.python');
    await vscode.extensions.getExtension('ms-python.debugpy')!.activate();
    await vscode.extensions.getExtension('ms-python.python')!.activate();
  });

  this.afterEach(async () => {
    await vscode.debug.stopDebugging();
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  });

  this.afterAll(() => vscode.commands.executeCommand('workbench.action.closeAllEditors'));

  test('[python] Test Call Stack', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'python');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'main.py');

    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    await executeWithBreakpoints({
      type: 'python',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    }, [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(12, 0))),
    ]);

    const stackTraceInfo = await getStacktraceInfo();
    assert.ok(stackTraceInfo, 'Failed to get stack trace info');
    validateStacktraceInfo(stackTraceInfo, [
      {
        code: "def dummy_method(self):\n        \"\"\"dummy method\"\"\"\n        print(\"This is a dummy method\", self.a, self.b)",
        file: "test_code/python/main.py",
        frameId: 2,
        language: "python",
        fileLocationOffset: {
          startLine: 11,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 2,
          startCharacter: 0,
        },
      },
      {
        code: "def deep_code():\n    \"\"\"i do stuff\"\"\"\n    a = {\"a\": 1, \"b\": 2, \"c\": 3}\n    x = Dummy()\n    x.dummy_method()\n    b = 2\n    c = 1 + b\n    d = c ** c\n    print(\"This is a deep code\", c, d)\n\n    def lol():\n        print(\"This is a lol function\")\n    lol()",
        file: "test_code/python/main.py",
        frameId: 3,
        language: "python",
        fileLocationOffset: {
          startLine: 16,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 4,
          startCharacter: 0,
        },
      },
      {
        code: "def main():\n    \"\"\"main code\"\"\"\n    print(\"This is a main code\")\n    a = 1\n    b = 2\n    c = a + b\n    deep_code()\n    deep_code()\n    deep_code()",
        file: "test_code/python/main.py",
        frameId: 4,
        language: "python",
        fileLocationOffset: {
          startLine: 31,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 6,
          startCharacter: 0,
        },
      },
      {
        code: "\nif __name__ == \"__main__\":\n    a = 1337\n    main()\n",
        file: "test_code/python/main.py",
        frameId: 5,
        language: "python",
        fileLocationOffset: {
          startLine: 41,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 3,
          startCharacter: 0,
        },
      },
    ]);
  });

  test('[python] Test Inspect variable', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'python');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'main.py');
    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    await executeWithBreakpoints({
      type: 'python',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    }, [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(18, 0))),
    ]);

    const valuePosition = await getCurrentValueForPosition(mainFileUri, 17, 5, 0);
    assert.ok(valuePosition, 'Failed to get stack trace info');
    // todo use validateVariableLookup
    assert.equal(valuePosition?.formattedValue, "{'a': 1, 'b': 2, 'c': 3}", 'Did not get the expected value');
    assert.equal(valuePosition?.variableInfo?.length, 6, 'found unexpected number of variables');
  });
});
