import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';
import { getStacktraceInfo } from '../../debug/callstack-extractor';
import { getCurrentValueForPosition } from '../../inspect';

suite('Test golang compatibility', function () {
  this.timeout(600_000);

  this.beforeAll(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    // install extensions
    let tries = 3;
    while (!vscode.extensions.getExtension('golang.go') && tries-- > 0) {

      await vscode.commands.executeCommand('workbench.extensions.installExtension', 'golang.go');
    }
    await vscode.extensions.getExtension('golang.go')!.activate();
  });

  this.afterEach(async () => {
    await vscode.debug.stopDebugging();
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  });

  test('[golang] Test Call Stack', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'go');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'main.go');

    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    const breakpoints = [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(24, 0))),
    ];
    vscode.debug.addBreakpoints(breakpoints);

    const config: vscode.DebugConfiguration = {
      type: 'go',
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
    assert.equal(stackTraceInfo[0].locationInCode.startLine, 1, 'Did not get the expected line inside function');
    assert.equal(stackTraceInfo[0].fileLocationOffset.startLine, 24, 'Did not get the expected offset in file');

    assert.equal(stackTraceInfo[3].locationInCode.startLine, 3, 'Did not get the expected line inside function');
    assert.equal(stackTraceInfo[3].fileLocationOffset.startLine, 1692, 'Did not get the expected offset in file');
  });

  test('[golang] Test Inspect variable', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'go');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'main.go');

    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    const breakpoints = [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(24, 0))),
    ];
    vscode.debug.addBreakpoints(breakpoints);

    const config: vscode.DebugConfiguration = {
      type: 'go',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    };

    const onStackItemChanged = new Promise<void>((resolve) => vscode.debug.onDidChangeActiveStackItem(() => resolve()));
    await vscode.debug.startDebugging(undefined, config);
    await onStackItemChanged; // wait for the first stack frame to be available

    const stackTraceInfo = await getStacktraceInfo();

    const valuePosition = await getCurrentValueForPosition(mainFileUri, 23, 10, stackTraceInfo[0].frameId);
    assert.ok(valuePosition, 'Failed to get stack trace info');
    assert.equal(valuePosition?.formattedValue, "5", 'Did not get the expected value');
    assert.equal(valuePosition?.variableInfo?.length, 1, 'found unexpected number of variables');


    const valuePosition2 = await getCurrentValueForPosition(mainFileUri, 23, 12, stackTraceInfo[0].frameId);
    assert.ok(valuePosition2, 'Failed to get stack trace info');
    assert.equal(valuePosition2?.formattedValue, "10", 'Did not get the expected value');
    assert.equal(valuePosition2?.variableInfo?.length, 1, 'found unexpected number of variables');

    const valuePosition3 = await getCurrentValueForPosition(mainFileUri, 6, 2, stackTraceInfo[1].frameId);
    assert.ok(valuePosition3, 'Failed to get stack trace info');
    assert.equal(valuePosition3?.formattedValue, "5", 'Did not get the expected value');
    assert.equal(valuePosition3?.variableInfo?.length, 1, 'found unexpected number of variables');
  });
});
