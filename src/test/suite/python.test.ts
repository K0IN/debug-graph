import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';
//import { getStacktraceInfo } from '../../debug/callstack-extractor';

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

    const success = vscode.workspace.updateWorkspaceFolders(
      vscode.workspace.workspaceFolders
        ? vscode.workspace.workspaceFolders.length
        : 0,
      null, { uri: vscode.Uri.from({ scheme: 'file', path: workspaceFolderPath }), name: 'python_code' });

    assert.ok(success, 'Failed to add workspace folder');

    const breakpoints = [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(13, 0))),
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(38, 0))),
    ];

    vscode.debug.addBreakpoints(breakpoints);
    /*
        const config: vscode.DebugConfiguration = {
          type: 'python',
          request: 'launch',
          name: 'Launch Program',
          program: mainFileUri.fsPath,
        };
    
        const workspace = vscode.workspace.workspaceFolders?.[0];
    
        const onStackItemChanged = new Promise<void>((resolve) => vscode.debug.onDidChangeActiveStackItem(() => resolve()));
        await vscode.debug.startDebugging(workspace, config);
        await onStackItemChanged;
    
        const stackTraceInfo = await getStacktraceInfo();
        assert.ok(stackTraceInfo, 'Failed to get stack trace info');
        // asset only the first and last stack frame for now
        assert.equal(stackTraceInfo.length, 4, 'Did not get the expected number of stack frames');
        assert.equal(stackTraceInfo[0].locationInCode.startLine, 2, 'Did not get the expected line inside function');
        assert.equal(stackTraceInfo[0].fileLocationOffset.startLine, 11, 'Did not get the expected offset in file');
    
        assert.equal(stackTraceInfo[3].locationInCode.startLine, 3, 'Did not get the expected line inside function');
        assert.equal(stackTraceInfo[3].fileLocationOffset.startLine, 41, 'Did not get the expected offset in file');
      */
  });
});
