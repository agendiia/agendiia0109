// Polyfill to expose Node's Buffer in browser environment for third-party libs
// Use named import so Vite doesn't try to access host-only exports.
import { Buffer } from 'buffer';

// Attach to globalThis if not present
if (typeof (globalThis as any).Buffer === 'undefined') {
	(globalThis as any).Buffer = Buffer;
}

export {};
