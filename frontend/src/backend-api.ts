import { inject, markRaw } from "vue"
import * as Comlink from "comlink/dist/esm/comlink";
import type { ComlinkBackendApi } from "shared/src";
import type { Endpoint } from "comlink/dist/esm/comlink";

// Create backend instance outside of any reactivity system
let backendInstance: ComlinkBackendApi | null = null;

export function useBackendApi(): ComlinkBackendApi {
    if (!backendInstance) {
        const channels = inject<Endpoint>('comlinkChannels');
        if (!channels) {
            throw new Error("Comlink channels not found, make sure they are provided in main.ts");
        }

        backendInstance = markRaw(Comlink.wrap<ComlinkBackendApi>(channels));
    }
    return backendInstance;
}
