import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';
import { getStacktraceInfo } from '../../debug/callstack-extractor';
import { getCurrentValueForPosition } from '../../inspect';

suite('Test python compatibility', function () {
  this.timeout(60_000);

  this.beforeAll(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    // install extensions
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

    const breakpoints = [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(12, 0))),
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(37, 0))),
    ];
    vscode.debug.addBreakpoints(breakpoints);

    const config: vscode.DebugConfiguration = {
      type: 'python',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    };

    const onStackItemChanged = new Promise<void>((resolve) => vscode.debug.onDidChangeActiveStackItem(() => resolve()));
    await vscode.debug.startDebugging(undefined, config);
    await onStackItemChanged; // wait for the first stack frame to be available

    const stackTraceInfo = await getStacktraceInfo();
    assert.ok(stackTraceInfo, 'Failed to get stack trace info');
    // asset only the first and last stack frame for now
    assert.equal(stackTraceInfo.length, 4, 'Did not get the expected number of stack frames');
    assert.equal(stackTraceInfo[0].locationInCode.startLine, 2, 'Did not get the expected line inside function');
    assert.equal(stackTraceInfo[0].fileLocationOffset.startLine, 11, 'Did not get the expected offset in file');

    assert.equal(stackTraceInfo[3].locationInCode.startLine, 3, 'Did not get the expected line inside function');
    assert.equal(stackTraceInfo[3].fileLocationOffset.startLine, 41, 'Did not get the expected offset in file');
  });

  test('[python] Test Inspect variable', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'python');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'main.py');

    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    const breakpoints = [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(18, 0))),
    ];
    vscode.debug.addBreakpoints(breakpoints);

    const config: vscode.DebugConfiguration = {
      type: 'python',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    };

    const onStackItemChanged = new Promise<void>((resolve) => vscode.debug.onDidChangeActiveStackItem(() => resolve()));
    await vscode.debug.startDebugging(undefined, config);
    await onStackItemChanged; // wait for the first stack frame to be available

    const valuePosition = await getCurrentValueForPosition(mainFileUri, 17, 5, 0);
    assert.ok(valuePosition, 'Failed to get stack trace info');
    assert.equal(valuePosition?.formattedValue, "{'a': 1, 'b': 2, 'c': 3}", 'Did not get the expected value');
    assert.equal(valuePosition?.variableInfo?.length, 6, 'found unexpected number of variables');
  });
});
