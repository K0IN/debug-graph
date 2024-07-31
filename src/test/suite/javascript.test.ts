import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';
import { getStacktraceInfo } from '../../debug/callstack-extractor';
import { validateStacktraceInfo, validateVariableLookup } from './validators';
import { getCurrentValueForPosition } from '../../inspect';
import { executeWithBreakpoints } from './execute-helper';

suite('Test javascript compatibility', function () {
  this.timeout(60_000);

  this.beforeAll(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  this.afterEach(async () => {
    await vscode.debug.stopDebugging();
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  });

  this.afterAll(() => vscode.commands.executeCommand('workbench.action.closeAllEditors'));

  test('[javascript] Test Call Stack', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'javascript_node');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'index.js');
    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    await executeWithBreakpoints({
      type: 'node',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    }, [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(30, 0))),
    ]);

    const stackTraceInfo = await getStacktraceInfo();
    assert.ok(stackTraceInfo, 'Failed to get stack trace info');

    validateStacktraceInfo(stackTraceInfo, [
      {
        code: "printStackTrace() {\r\n    console.trace(`Stack trace for ${this.name}`);\r\n  }",
        file: "/e:/src/stacktrace-history/test_code/javascript_node/index.js",
        frameId: 0,
        language: "javascript",
        fileLocationOffset: {
          startLine: 30,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 1,
          startCharacter: 0,
        },
      },
      {
        code: "callGrandchild() {\r\n    const grandchild = new Grandchild();\r\n    grandchild.printStackTrace();\r\n  }",
        file: "/e:/src/stacktrace-history/test_code/javascript_node/index.js",
        frameId: 1,
        language: "javascript",
        fileLocationOffset: {
          startLine: 18,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 2,
          startCharacter: 0,
        },
      },
      {
        code: "callChild() {\r\n    const child = new Child();\r\n    child.callGrandchild();\r\n  }",
        file: "/e:/src/stacktrace-history/test_code/javascript_node/index.js",
        frameId: 2,
        language: "javascript",
        fileLocationOffset: {
          startLine: 6,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 2,
          startCharacter: 0,
        },
      },
      {
        code: "}\r\n\r\nconst obj = new Parent();\r\nobj.callChild();\r\n\r\nfunction showAllStackTraces() {\r\n  const grandchild = new Grandchild();",
        file: "/e:/src/stacktrace-history/test_code/javascript_node/index.js",
        frameId: 3,
        language: "javascript",
        fileLocationOffset: {
          startLine: 33,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 3,
          startCharacter: 0,
        },
      },
    ]);
  });

  test('[javascript] Test Inspect variable', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'javascript_node');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'index.js');

    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    await executeWithBreakpoints({
      type: 'node',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    }, [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(30, 0))),
    ]);

    const stackTraceInfo = await getStacktraceInfo();
    assert.ok(stackTraceInfo, 'Failed to get stack trace info');

    const valuePosition = await getCurrentValueForPosition(mainFileUri, 30, 45, stackTraceInfo[0].frameId);
    assert.ok(valuePosition, 'Failed to get stack trace info');
    validateVariableLookup(valuePosition, {
      provider: "eval",
      formattedValue: "'Grandchild'",
      variableInfo: [
        {
          name: "name",
          value: "'Grandchild'",
          type: "string",
        },
      ],
    });
  });
});
