import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import type { } from "vscode-webview"; // this defines globals (acquireVsCodeApi)
import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor'
import { allComponents, provideVSCodeDesignSystem } from "@vscode/webview-ui-toolkit";
import type { CallLocation } from 'shared/src';
import { getComlinkChannel } from './messaging';

provideVSCodeDesignSystem().register(allComponents);
const vscode = acquireVsCodeApi<{ denseMode: boolean }>();
export const stacktraceMap = new Map</* editor.ITextModel.id */string, CallLocation>();

// Initialize Comlink channels early
const comlinkChannels = getComlinkChannel(vscode);

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);

app.provide('vscode', vscode);
app.provide('comlinkChannels', comlinkChannels);

app.use(VueMonacoEditorPlugin, { paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' }, });
app.mount('#app');
