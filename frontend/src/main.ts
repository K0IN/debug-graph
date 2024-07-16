import { createApp } from 'vue'
import App from './App.vue'
import type { } from "vscode-webview"; // this defines globals (acquireVsCodeApi)
import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor'
import { allComponents, provideVSCodeDesignSystem } from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register(allComponents);
export const vscode = acquireVsCodeApi();

const app = createApp(App);
app.use(VueMonacoEditorPlugin, { paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' } });
app.mount('#app');
