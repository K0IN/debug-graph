import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';

suite('Test python compatibility', function () {
  this.timeout(60_000);

  this.beforeAll(async () => {
    await vscode.extensions.getExtension('ms-python.debugpy')?.activate();
    await vscode.extensions.getExtension('ms-python.python')?.activate();
  });

  this.afterEach(async () => {
    vscode.debug.stopDebugging();
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  });

  test('Test Call Stack', async () => {

    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'python');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'main.py');

    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    const folders = vscode.workspace.workspaceFolders;

    const success = vscode.workspace.updateWorkspaceFolders(
      folders
        ? folders.length
        : 0,
      null, { uri: vscode.Uri.from({ scheme: 'file', path: workspaceFolderPath }), name: 'python_code' });

    assert.ok(success, 'Failed to add workspace folder');
    // assert.ok(vscode.workspace.workspaceFolders, 'Failed to get workspace folders');
    // const workspace = vscode.workspace.workspaceFolders?.[0];
    // assert.ok(workspace, 'Failed to get workspace folder');

    const breakpoints = [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(13, 0))),
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(38, 0))),
    ];

    vscode.debug.addBreakpoints(breakpoints);


    // (vscode.workspace.workspaceFolders as any) = [mockWorkspaceFolder];
    const config: vscode.DebugConfiguration = {
      type: 'python',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    };

    console.log('config = ', config);
    // const onStackItemChanged = new Promise<void>((resolve) => vscode.debug.onDidChangeActiveStackItem(() => resolve()));
    // await vscode.debug.startDebugging(undefined, config);
    // await onStackItemChanged;

    // const stackTraceInfo = await getStacktraceInfo();
    // assert.ok(stackTraceInfo, 'Failed to get stack trace info');
    // // asset only the first and last stack frame for now
    // assert.equal(stackTraceInfo.length, 4, 'Did not get the expected number of stack frames');
    // assert.equal(stackTraceInfo[0].locationInCode.startLine, 2, 'Did not get the expected line inside function');
    // assert.equal(stackTraceInfo[0].fileLocationOffset.startLine, 11, 'Did not get the expected offset in file');

    // assert.equal(stackTraceInfo[3].locationInCode.startLine, 3, 'Did not get the expected line inside function');
    // assert.equal(stackTraceInfo[3].fileLocationOffset.startLine, 41, 'Did not get the expected offset in file');

  });
});
