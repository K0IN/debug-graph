import { window, OutputChannel } from "vscode";

let _channel: OutputChannel | undefined;

function getChannel(): OutputChannel {
    if (!_channel) {
        _channel = window.createOutputChannel("Debug Graph");
    }
    return _channel;
}

function formatTimestamp(): string {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

function formatMessage(level: string, message: string, args: unknown[]): string {
    const timestamp = formatTimestamp();
    if (args.length === 0) {
        return `${timestamp} [${level}] ${message}`;
    }
    const serialized = args.map(a => a instanceof Error ? `${a.message}\n${a.stack}` : JSON.stringify(a, null, 0)).join(' ');
    return `${timestamp} [${level}] ${message} ${serialized}`;
}

export function logDebug(message: string, ...args: unknown[]): void {
    getChannel().appendLine(formatMessage('DEBUG', message, args));
}

export function logInfo(message: string, ...args: unknown[]): void {
    getChannel().appendLine(formatMessage('INFO', message, args));
}

export function logWarn(message: string, ...args: unknown[]): void {
    getChannel().appendLine(formatMessage('WARN', message, args));
}

export function logError(message: string, error?: unknown): void {
    const timestamp = formatTimestamp();
    if (error instanceof Error) {
        const errorStr = `${error.message}\n${error.stack}`;
        getChannel().appendLine(`${timestamp} [ERROR] ${message} ${errorStr}`);
    } else if (error !== undefined) {
        getChannel().appendLine(`${timestamp} [ERROR] ${message} ${String(error)}`);
    } else {
        getChannel().appendLine(`${timestamp} [ERROR] ${message}`);
    }
}

export function showOutputChannel(): void {
    getChannel().show();
}