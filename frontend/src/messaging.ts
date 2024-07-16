import type { Endpoint } from "comlink/dist/esm/comlink";
import { vscode } from "./main";

export function getComlinkChannel(): Endpoint {
  return {
    addEventListener: (type: string, listener: any) => window.addEventListener(type, listener),
    removeEventListener: window.removeEventListener,
    postMessage: (object: any) => vscode.postMessage(object),
  };
}
