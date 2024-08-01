import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';
import { getStacktraceInfo } from '../../debug/callstack-extractor';
import { getCurrentValueForPosition } from '../../inspect';
import { executeWithBreakpoints } from './execute-helper';
import { validateStacktraceInfo, validateVariableLookup } from './validators';

suite('Test golang compatibility', function () {
  this.timeout(60_000);

  this.beforeAll(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('workbench.extensions.installExtension', 'golang.go');
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

    await executeWithBreakpoints({
      type: 'go',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    }, [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(24, 0))),
    ]);

    const stackTraceInfo = await getStacktraceInfo();
    assert.ok(stackTraceInfo, 'Failed to get stack trace info');
    // asset only the first and last stack frame for now
    validateStacktraceInfo(stackTraceInfo, [
      {
        code: "func add(a, b int) int {\n\treturn a + b\n}",
        file: "test_code/go/main.go",
        language: "go",
        fileLocationOffset: {
          startLine: 24,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 1,
          startCharacter: 0,
        },
      },
      {
        code: "func main() {\n\t// Example code\n\tx := 5\n\ty := 10\n\n\t// Print debug information\n\tfmt.Println(\"Debug information:\")\n\tfmt.Println(\"x =\", x)\n\tfmt.Println(\"y =\", y)\n\n\t// Call other functions\n\tsum := add(x, y)\n\tproduct := multiply(x, y)\n\n\t// Print the results\n\tfmt.Println(\"Sum =\", sum)\n\tfmt.Println(\"Product =\", product)\n}",
        file: "test_code/go/main.go",
        language: "go",
        fileLocationOffset: {
          startLine: 5,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 11,
          startCharacter: 0,
        },
      },
      {
        code: "func main() {\n\tmp := getg().m\n\n\t// Racectx of m0->g0 is used only as the parent of the main goroutine.\n\t// It must not be used for anything else.\n\tmp.g0.racectx = 0\n\n\t// Max stack size is 1 GB on 64-bit, 250 MB on 32-bit.\n\t// Using decimal instead of binary GB and MB because\n\t// they look nicer in the stack overflow failure message.\n\tif goarch.PtrSize == 8 {\n\t\tmaxstacksize = 1000000000\n\t} else {\n\t\tmaxstacksize = 250000000\n\t}\n\n\t// An upper limit for max stack size. Used to avoid random crashes\n\t// after calling SetMaxStack and trying to allocate a stack that is too big,\n\t// since stackalloc works with 32-bit sizes.\n\tmaxstackceiling = 2 * maxstacksize\n\n\t// Allow newproc to start new Ms.\n\tmainStarted = true\n\n\tif GOARCH != \"wasm\" { // no threads on wasm yet, so no sysmon\n\t\tsystemstack(func() {\n\t\t\tnewm(sysmon, nil, -1)\n\t\t})\n\t}\n\n\t// Lock the main goroutine onto this, the main OS thread,\n\t// during initialization. Most programs won't care, but a few\n\t// do require certain calls to be made by the main thread.\n\t// Those can arrange for main.main to run in the main thread\n\t// by calling runtime.LockOSThread during initialization\n\t// to preserve the lock.\n\tlockOSThread()\n\n\tif mp != &m0 {\n\t\tthrow(\"runtime.main not on m0\")\n\t}\n\n\t// Record when the world started.\n\t// Must be before doInit for tracing init.\n\truntimeInitTime = nanotime()\n\tif runtimeInitTime == 0 {\n\t\tthrow(\"nanotime returning zero\")\n\t}\n\n\tif debug.inittrace != 0 {\n\t\tinittrace.id = getg().goid\n\t\tinittrace.active = true\n\t}\n\n\tdoInit(runtime_inittasks) // Must be before defer.\n\n\t// Defer unlock so that runtime.Goexit during init does the unlock too.\n\tneedUnlock := true\n\tdefer func() {\n\t\tif needUnlock {\n\t\t\tunlockOSThread()\n\t\t}\n\t}()\n\n\tgcenable()\n\n\tmain_init_done = make(chan bool)\n\tif iscgo {\n\t\tif _cgo_pthread_key_created == nil {\n\t\t\tthrow(\"_cgo_pthread_key_created missing\")\n\t\t}\n\n\t\tif _cgo_thread_start == nil {\n\t\t\tthrow(\"_cgo_thread_start missing\")\n\t\t}\n\t\tif GOOS != \"windows\" {\n\t\t\tif _cgo_setenv == nil {\n\t\t\t\tthrow(\"_cgo_setenv missing\")\n\t\t\t}\n\t\t\tif _cgo_unsetenv == nil {\n\t\t\t\tthrow(\"_cgo_unsetenv missing\")\n\t\t\t}\n\t\t}\n\t\tif _cgo_notify_runtime_init_done == nil {\n\t\t\tthrow(\"_cgo_notify_runtime_init_done missing\")\n\t\t}\n\n\t\t// Set the x_crosscall2_ptr C function pointer variable point to crosscall2.\n\t\tif set_crosscall2 == nil {\n\t\t\tthrow(\"set_crosscall2 missing\")\n\t\t}\n\t\tset_crosscall2()\n\n\t\t// Start the template thread in case we enter Go from\n\t\t// a C-created thread and need to create a new thread.\n\t\tstartTemplateThread()\n\t\tcgocall(_cgo_notify_runtime_init_done, nil)\n\t}\n\n\t// Run the initializing tasks. Depending on build mode this\n\t// list can arrive a few different ways, but it will always\n\t// contain the init tasks computed by the linker for all the\n\t// packages in the program (excluding those added at runtime\n\t// by package plugin). Run through the modules in dependency\n\t// order (the order they are initialized by the dynamic\n\t// loader, i.e. they are added to the moduledata linked list).\n\tfor m := &firstmoduledata; m != nil; m = m.next {\n\t\tdoInit(m.inittasks)\n\t}\n\n\t// Disable init tracing after main init done to avoid overhead\n\t// of collecting statistics in malloc and newproc\n\tinittrace.active = false\n\n\tclose(main_init_done)\n\n\tneedUnlock = false\n\tunlockOSThread()\n\n\tif isarchive || islibrary {\n\t\t// A program compiled with -buildmode=c-archive or c-shared\n\t\t// has a main, but it is not executed.\n\t\treturn\n\t}\n\tfn := main_main // make an indirect call, as the linker doesn't know the address of the main package when laying down the runtime\n\tfn()\n\tif raceenabled {\n\t\trunExitHooks(0) // run hooks now, since racefini does not return\n\t\tracefini()\n\t}\n\n\t// Make racy client program work: if panicking on\n\t// another goroutine at the same time as main returns,\n\t// let the other goroutine finish printing the panic trace.\n\t// Once it does, it will exit. See issues 3934 and 20018.\n\tif runningPanicDefers.Load() != 0 {\n\t\t// Running deferred functions should not take long.\n\t\tfor c := 0; c < 1000; c++ {\n\t\t\tif runningPanicDefers.Load() == 0 {\n\t\t\t\tbreak\n\t\t\t}\n\t\t\tGosched()\n\t\t}\n\t}\n\tif panicking.Load() != 0 {\n\t\tgopark(nil, nil, waitReasonPanicWait, traceBlockForever, 1)\n\t}\n\trunExitHooks(0)\n\n\texit(0)\n\tfor {\n\t\tvar x *int32\n\t\t*x = 0\n\t}\n}",
        file: undefined,
        language: "go",
        fileLocationOffset: {
          startLine: 146,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 125,
          startCharacter: 0,
        },
      },
      {
        code: "// The top-most function running on a goroutine\n// returns to goexit+PCQuantum.\nTEXT runtime·goexit(SB),NOSPLIT|TOPFRAME|NOFRAME,$0-0\n\tBYTE\t$0x90\t// NOP\n\tCALL\truntime·goexit1(SB)\t// does not return\n\t// traceback from goexit1 must hit code range of goexit\n\tBYTE\t$0x90\t// NOP",
        file: undefined,
        language: "plaintext",
        fileLocationOffset: {
          startLine: 1692,
          startCharacter: 0,
        },
        locationInCode: {
          startLine: 3,
          startCharacter: 0,
        },
      },
    ]);
  });

  test('[golang] Test Inspect variable', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../test_code/');
    const workspaceFolderPath = path.join(extensionDevelopmentPath, 'go');
    const workspaceTestFilePath = path.join(workspaceFolderPath, 'main.go');

    const mainFileUri = vscode.Uri.file(workspaceTestFilePath);

    await executeWithBreakpoints({
      type: 'go',
      request: 'launch',
      name: 'Launch Program',
      program: mainFileUri.fsPath,
    }, [
      new vscode.SourceBreakpoint(new vscode.Location(mainFileUri, new vscode.Position(24, 0))),
    ]);


    const stackTraceInfo = await getStacktraceInfo();

    const valuePosition = await getCurrentValueForPosition(mainFileUri, 23, 10, stackTraceInfo[0].frameId);
    assert.ok(valuePosition, 'Failed to get stack trace info');
    validateVariableLookup(valuePosition, {
      provider: "eval",
      formattedValue: "5",
      variableInfo: [
        {
          name: "a",
          value: "5",
          type: "int",
        },
      ],
    });

    const valuePosition2 = await getCurrentValueForPosition(mainFileUri, 23, 12, stackTraceInfo[0].frameId);
    assert.ok(valuePosition2, 'Failed to get stack trace info');
    validateVariableLookup(valuePosition2, {
      provider: "eval",
      formattedValue: "10",
      variableInfo: [
        {
          name: "b",
          value: "10",
          type: "int",
        },
      ],
    });

    const valuePosition3 = await getCurrentValueForPosition(mainFileUri, 6, 2, stackTraceInfo[1].frameId);
    assert.ok(valuePosition3, 'Failed to get stack trace info');
    validateVariableLookup(valuePosition3, {
      provider: "eval",
      formattedValue: "5",
      variableInfo: [
        {
          name: "x",
          value: "5",
          type: "int",
        },
      ],
    });
  });
});
