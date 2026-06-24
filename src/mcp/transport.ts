import * as net from 'net';

export function comlinkEndpointFromSocket(socket: net.Socket) {
    const listeners = new Set<(event: { data: unknown }) => void>();
    let buffer = '';

    socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            try {
                const msg = JSON.parse(trimmed);
                for (const listener of listeners) {
                    listener({ data: msg });
                }
            } catch {}
        }
    });

    socket.on('close', () => listeners.clear());
    socket.on('error', () => listeners.clear());

    return {
        postMessage(msg: unknown) {
            socket.write(JSON.stringify(msg) + '\n');
        },
        addEventListener(_type: string, listener: (...args: any[]) => void, _options?: {}) {
            listeners.add(listener as (event: { data: unknown }) => void);
        },
        removeEventListener(_type: string, listener: (...args: any[]) => void, _options?: {}) {
            listeners.delete(listener as (event: { data: unknown }) => void);
        },
        start() {},
    };
}
