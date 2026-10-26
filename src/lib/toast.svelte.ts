type Toast = { id: number; text: string; tone: 'info' | 'error' };

let nextId = 1;
export const toasts = $state<Toast[]>([]);

export function toast(text: string, tone: Toast['tone'] = 'info') {
	const id = nextId++;
	toasts.push({ id, text, tone });
	setTimeout(() => {
		const i = toasts.findIndex((t) => t.id === id);
		if (i >= 0) toasts.splice(i, 1);
	}, 3200);
}
