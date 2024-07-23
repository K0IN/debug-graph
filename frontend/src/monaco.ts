import { useMonaco } from "@guolao/vue-monaco-editor";
import { nextTick, watchEffect } from "vue";

export type MonacoRefType = ReturnType<typeof useMonaco>['monacoRef']['value'];

export function useMonacoGlobalInit(fn: (ref: MonacoRefType) => void | Promise<void>) {
  const { monacoRef } = useMonaco();
  // watch once
  const stop = watchEffect(() => {
    if (monacoRef.value) {
      nextTick(() => stop());
      fn(monacoRef.value as MonacoRefType);
    }
  });
}