import { window, OutputChannel } from "vscode";

let _channel: OutputChannel | undefined;

function getChannel(): OutputChannel {
    if (!_channel) {
        _channel = window.createOutputChannel("Debug Graph");
    }
    return _channel;
}

export function logDebug(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const formatted = args.length > 0
        ? `${timestamp} [DEBUG] ${message} ${args.map(a => JSON.stringify(a, null, 0)).join(' ')}`
        : `${timestamp} [DEBUG] ${message}`;
    getChannel().appendLine(formatted);
}

export function logInfo(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const formatted = args.length > 0
        ? `${timestamp} [INFO] ${message} ${args.map(a => JSON.stringify(a, null, 0)).join(' ')}`
        : `${timestamp} [INFO] ${message}`;
    getChannel().appendLine(formatted);
}

export function logWarn(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const formatted = args.length > 0
        ? `${timestamp} [WARN] ${message} ${args.map(a => JSON.stringify(a, null, 0)).join(' ')}`
        : `${timestamp} [WARN] ${message}`;
    getChannel().appendLine(formatted);
}

export function logError(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const errorStr = error instanceof Error ? `${error.message}\n${error.stack}` : String(error ?? '');
    getChannel().appendLine(`${timestamp} [ERROR] ${message} ${errorStr}`);
}

export function showOutputChannel(): void {
    getChannel().show();
}