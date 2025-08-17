import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import type { } from "vscode-webview"; // this defines globals (acquireVsCodeApi)
import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor'
import { allComponents, provideVSCodeDesignSystem } from "@vscode/webview-ui-toolkit";
import { getComlinkChannel } from './messaging';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

provideVSCodeDesignSystem().register(allComponents);


const vscode = acquireVsCodeApi<{ denseMode: boolean }>();
const comlinkChannels = getComlinkChannel(vscode);

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);

app.provide('vscode', vscode);
app.provide('comlinkChannels', comlinkChannels);

app.use(VueMonacoEditorPlugin, { monaco: monacoEditor });
app.mount('#app');
