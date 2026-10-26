/** Label colors, named as in TimeTree's palette. */
export const LABEL_COLORS: { hex: string; name: string }[] = [
	{ hex: '#2ECC87', name: 'Emerald green' },
	{ hex: '#3DC2C8', name: 'Modern cyan' },
	{ hex: '#47B2F7', name: 'Deep sky blue' },
	{ hex: '#B38BDC', name: 'Soft violet' },
	{ hex: '#F35F8C', name: 'French rose' },
	{ hex: '#E73B3B', name: 'Apple red' },
	{ hex: '#FDC02D', name: 'Bright orange' },
	{ hex: '#948078', name: 'Pastel brown' },
	{ hex: '#36393D', name: 'Midnight black' },
	{ hex: '#FB7F77', name: 'Coral pink' }
];

export const MATERIAL_COLORS: { hex: string; name: string }[] = [
	{ hex: '#D81B60', name: 'Pink' },
	{ hex: '#8E24AA', name: 'Purple' },
	{ hex: '#5E35B1', name: 'Deep Purple' },
	{ hex: '#3949AB', name: 'Indigo' },
	{ hex: '#1E88E5', name: 'Blue' },
	{ hex: '#039BE5', name: 'Light Blue' },
	{ hex: '#00ACC1', name: 'Cyan' },
	{ hex: '#43A047', name: 'Green' },
	{ hex: '#7CB342', name: 'Light Green' },
	{ hex: '#C0CA33', name: 'Lime' },
	{ hex: '#FDD835', name: 'Yellow' },
	{ hex: '#FFB300', name: 'Amber' },
	{ hex: '#FB8C00', name: 'Orange' },
	{ hex: '#F4511E', name: 'Deep Orange' },
	{ hex: '#757575', name: 'Dark Gray' },
	{ hex: '#212121', name: 'Midnight black' }
];

export const ALL_COLORS = [...LABEL_COLORS, ...MATERIAL_COLORS];

export function colorName(hex: string): string {
	return ALL_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

/** Black or white text, whichever reads better on the given background. */
export function textOn(hex: string): string {
	const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return lum > 0.68 ? '#1b1b1b' : '#ffffff';
}

export const isHexColor = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
