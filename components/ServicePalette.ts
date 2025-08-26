import { Service } from '../types';

export type ServicePaletteEntry = { selectedBg: string; selectedText: string; border: string; bg: string; text: string; hex?: string };

export const servicePalette: ServicePaletteEntry[] = [
    { selectedBg: 'bg-indigo-600', selectedText: 'text-white', border: 'border-indigo-400', bg: 'bg-indigo-50', text: 'text-indigo-700', hex: '#4f46e5' },
    { selectedBg: 'bg-green-600', selectedText: 'text-white', border: 'border-green-400', bg: 'bg-green-50', text: 'text-green-700', hex: '#16a34a' },
    { selectedBg: 'bg-yellow-500', selectedText: 'text-white', border: 'border-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', hex: '#eab308' },
    { selectedBg: 'bg-pink-600', selectedText: 'text-white', border: 'border-pink-400', bg: 'bg-pink-50', text: 'text-pink-700', hex: '#db2777' },
    { selectedBg: 'bg-red-600', selectedText: 'text-white', border: 'border-red-400', bg: 'bg-red-50', text: 'text-red-700', hex: '#dc2626' },
    { selectedBg: 'bg-teal-600', selectedText: 'text-white', border: 'border-teal-400', bg: 'bg-teal-50', text: 'text-teal-700', hex: '#0d9488' },
    { selectedBg: 'bg-blue-600', selectedText: 'text-white', border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', hex: '#2563eb' },
];

// Simple deterministic string -> number hash (djb2) to map service id/name to palette index
export function hashStringToIndex(key: string, modulus = servicePalette.length): number {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) + hash) + key.charCodeAt(i);
        // keep in 32-bit range
        hash = hash & 0xffffffff;
    }
    return Math.abs(hash) % modulus;
}

// Resolve a palette entry for a service. Prefer service.id if available; if passed services list, try to find id by name.
export function getPaletteForService(serviceIdentifier: string, services?: Service[], overrides?: Record<string, number>): ServicePaletteEntry {
    // Prefer overrides mapping (serviceId -> paletteIndex)
    try {
        const serviceId = (services && services.find(s => s.id === serviceIdentifier)?.id) || serviceIdentifier;
        if (overrides && serviceId && Object.prototype.hasOwnProperty.call(overrides, serviceId)) {
            const idx = overrides[serviceId];
            if (typeof idx === 'number' && idx >= 0 && idx < servicePalette.length) return servicePalette[idx];
        }
    } catch (e) {
        // ignore and fallback to hash
    }

    // If services list provided, try to find by id/name and hash on id
    if (services && services.length > 0) {
        const foundById = services.find(s => s.id === serviceIdentifier);
        if (foundById) {
            const idx = hashStringToIndex(foundById.id);
            return servicePalette[idx];
        }
        const foundByName = services.find(s => s.name === serviceIdentifier);
        if (foundByName) {
            const idx = hashStringToIndex(foundByName.id);
            return servicePalette[idx];
        }
    }

    // Fallback: hash the provided identifier (name or id)
    const idx = hashStringToIndex(serviceIdentifier || 'default');
    return servicePalette[idx];
}

export default servicePalette;
