import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';
import { getStacktraceInfo } from '../../debug/callstack-extractor';
import { executeWithBreakpoints } from './execute-helper';

suite('Test c# compatibility', function () {
  this.timeout(60_000);

  this.beforeAll(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('workbench.extensions.installExtension', 'ms-dotnettools.csharp');
    await vscode.commands.executeCommand('workbench.extensions.installExtension', 'ms-dotnettools.csdevkit');

    await vscode.extensions.getExtension('ms-dotnettools.csharp')!.activate();
    await vscode.extensions.getExtension('ms-dotnettools.csdevkit')!.activate();
  });

  this.afterEach(async () => {
    await vscode.debug.stopDebugging();
    vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  });

  this.afterAll(() => vscode.commands.executeCommand('workbench.action.closeAllEditors'));

  test('[c#] Test Call Stack', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'c_sharp');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'test/Program.cs');
    const projectPath = vscode.Uri.file(path.join(workspaceFolderPath, 'test/test.csproj'));
    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFolderPath));

    await executeWithBreakpoints({
      type: 'dotnet',
      request: 'launch',
      name: "C#: test Debug",
      program: mainFileUri.fsPath,
      projectPath,
    }, [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(12, 0))),
    ]);

    const stackTraceInfo = await getStacktraceInfo();
    assert.ok(stackTraceInfo, 'Failed to get stack trace info');
  });

  //  test('[c#] Test Inspect variable', async () => {
  //    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
  //    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'python');
  //    const workspaceTestFilePath = path.join(workspaceFolderPath, 'main.py');
  //    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);
  //
  //    await executeWithBreakpoints({
  //      type: 'python',
  //      request: 'launch',
  //      name: 'Launch Program',
  //      program: mainFileUri.fsPath,
  //    }, [
  //      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(18, 0))),
  //    ]);
  //
  //    const valuePosition = await getCurrentValueForPosition(mainFileUri, 17, 5, 0);
  //    assert.ok(valuePosition, 'Failed to get stack trace info');
  //    // todo use validateVariableLookup
  //    assert.equal(valuePosition?.formattedValue, "{'a': 1, 'b': 2, 'c': 3}", 'Did not get the expected value');
  //    assert.equal(valuePosition?.variableInfo?.length, 6, 'found unexpected number of variables');
  //  });
});
