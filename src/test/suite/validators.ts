import { CallLocation, StackTraceInfo, SerializedRange, ValueLookupResult, VariableInfo } from "shared/src";
import * as assert from 'assert';

type MaybePath = Omit<CallLocation, 'file' | 'frameId'> & { file?: string, frameId?: number };

function validateSerializedRange(value: SerializedRange, expected: SerializedRange) {
  assert.equal(value.startLine, expected.startLine, "Start line does not match");
  assert.equal(value.startCharacter, expected.startCharacter, "Start character does not match");
  assert.equal(value.endLine, expected.endLine, "End line does not match");
  assert.equal(value.endCharacter, expected.endCharacter, "End character does not match");
}

function validateCallLocation(value: CallLocation, expected: MaybePath) {
  assert.ok(value.frameId !== undefined, "FrameId is not set"); // this can differ from call to call
  assert.equal(value.code, expected.code, "Code does not match");
  if (expected.file !== undefined) {
    assert.ok(value.file.endsWith(expected.file), "File does not match");
  }
  assert.equal(value.language, expected.language, "Language does not match");
  validateSerializedRange(value.fileLocationOffset, expected.fileLocationOffset);
  validateSerializedRange(value.locationInCode, expected.locationInCode);
}

export function validateStacktraceInfo(value: StackTraceInfo, expected: MaybePath[]) {
  assert.equal(value.length, expected.length, "Stack trace length does not match");
  for (let i = 0; i < value.length; i++) {
    validateCallLocation(value[i], expected[i]);
  }
}

function validateVariableInfo(value: VariableInfo, expected: VariableInfo) {

  assert.equal(value.name, expected.name, "Name does not match");
  assert.equal(value.value, expected.value, "Value does not match");
  assert.equal(value.type, expected.type, "Type does not match");

  if (value.subVariables && expected.subVariables) {
    assert.equal(value.subVariables.length, expected.subVariables.length, "Sub variables length does not match");
    for (let i = 0; i < value.subVariables.length; i++) {
      validateVariableInfo(value.subVariables[i], expected.subVariables[i]);
    }
  }
}

export function validateVariableLookup(value: ValueLookupResult, expected: ValueLookupResult) {
  assert.equal(value.provider, expected.provider, "Provider does not match");
  assert.equal(value.formattedValue, expected.formattedValue, "Formatted value does not match");
  assert.equal(value.variableInfo?.length, expected.variableInfo?.length, "Variable info length does not match");

  for (const variable of value.variableInfo || []) {
    const expectedVariable = expected.variableInfo?.find((v) => v.name === variable.name);
    assert.ok(expectedVariable, `Could not find variable ${variable.name}`);
    validateVariableInfo(variable, expectedVariable!);
  }
}