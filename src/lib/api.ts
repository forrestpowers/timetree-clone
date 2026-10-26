/** JSON fetch helper for the app's own endpoints. Throws with the server's message on failure. */
export async function api<T = unknown>(url: string, method = 'GET', body?: unknown): Promise<T> {
	const res = await fetch(url, {
		method,
		headers:
			body === undefined || body instanceof FormData
				? undefined
				: { 'content-type': 'application/json' },
		body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)
	});
	const text = await res.text();
	const data = text ? safeJson(text) : null;
	if (!res.ok) {
		const message =
			(data && typeof data === 'object' && 'message' in data && String(data.message)) ||
			(res.status === 413 ? 'The file is too large.' : `Request failed (${res.status})`);
		throw new Error(message);
	}
	return data as T;
}

function safeJson(text: string) {
	try {
		return JSON.parse(text);
	} catch {
		return { message: text };
	}
}

/** Downscale an image in the browser before upload. */
export async function resizeImage(file: File, maxSize: number, quality = 0.85): Promise<File> {
	if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
	const bitmap = await createImageBitmap(file).catch(() => null);
	if (!bitmap) return file;
	const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
	if (!blob) return file;
	return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
