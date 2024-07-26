import type { Endpoint } from "comlink/dist/esm/comlink";
import { vscode } from "./main";

export function getComlinkChannel(): Endpoint {
  return {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => window.addEventListener(type, listener),
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _options?: {}) => window.removeEventListener(type, listener),
    postMessage: (object: unknown) => vscode.postMessage(object),
  };
}
