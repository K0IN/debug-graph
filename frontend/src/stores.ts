import { defineStore } from "pinia"
import { inject, shallowRef, ref } from "vue"
import * as Comlink from "comlink/dist/esm/comlink";
import type { ComlinkFrontendApi, MonacoTheme, StackTraceInfo, CallLocation } from "shared/src";
import type { Endpoint } from "comlink";


export const useVsEvents = defineStore('vscode-backend', () => {
    console.log("Initializing backend store");

    const channels = inject<Endpoint>('comlinkChannels');
    console.log("Comlink channels", channels);
    const stackTrace = ref<StackTraceInfo>([]);
    const theme = shallowRef<MonacoTheme>();

    // // Expose the API after creating the reactive refs
    const frontendApi: ComlinkFrontendApi = {
        setStackTrace: async (st: StackTraceInfo) => {
            const start = Date.now();
            console.log("Setting stack trace, frames:", st.length);
            stackTrace.value = st;
            console.log(`setStackTrace completed in ${Date.now() - start}ms`);
        },
        setTheme: (newTheme: MonacoTheme) => {
            const start = Date.now();
            console.log("Setting theme");
            theme.value = newTheme;
            console.log(`setTheme completed in ${Date.now() - start}ms`);
        }
    };

    Comlink.expose(frontendApi, channels);

    // console.log("Backend store initialized", backend);
    return {
        stackTrace,
        theme
    };
});


export const useGlobalSettingsStore = defineStore('vscode-global-settings', () => {
    const STORAGE_KEY = 'debug-graph-settings';

    // Load initial settings from localStorage
    const loadSettings = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to load settings from localStorage:', error);
            return {};
        }
    };

    // Save settings to localStorage
    const saveSettings = (settings: Record<string, any>) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save settings to localStorage:', error);
        }
    };

    const initialSettings = loadSettings();
    const denseMode = ref<boolean>(initialSettings.denseMode ?? false);

    return {
        denseMode,
        setDenseMode: (enabled: boolean) => {
            denseMode.value = enabled;
            saveSettings({
                denseMode: enabled
            });
        }
    };
});

export const useStacktraceMapStore = defineStore('stacktrace-map', () => {
    // Map from Monaco editor model ID to CallLocation
    const stacktraceMap = ref(new Map<string, CallLocation>());

    const registerEditor = (editorId: string, callLocation: CallLocation) => {
        stacktraceMap.value.set(editorId, callLocation);
    };

    const unregisterEditor = (editorId: string) => {
        stacktraceMap.value.delete(editorId);
    };

    const getCallLocation = (editorId: string): CallLocation | undefined => {
        return stacktraceMap.value.get(editorId);
    };

    const clear = () => {
        stacktraceMap.value.clear();
    };

    return {
        stacktraceMap: stacktraceMap,
        registerEditor,
        unregisterEditor,
        getCallLocation,
        clear
    };
});
