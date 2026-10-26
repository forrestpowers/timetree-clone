/**
 * Touch-friendly drag-to-reorder for a vertical list. Items need `data-sort-id`;
 * dragging starts from an element with `data-sort-handle`. The DOM is never
 * reordered here (Svelte owns it): items are shifted with transforms and the
 * new order is reported through `onsort` when the drag ends.
 */
export function sortable(node: HTMLElement, onsort: (ids: string[]) => void) {
	let dragged: HTMLElement | null = null;
	let list: HTMLElement[] = [];
	let mids: number[] = [];
	let from = 0;
	let to = 0;
	let startY = 0;
	let pointerId = 0;

	function down(e: PointerEvent) {
		const handle = (e.target as HTMLElement).closest('[data-sort-handle]');
		if (!handle || !node.contains(handle)) return;
		dragged = handle.closest<HTMLElement>('[data-sort-id]');
		if (!dragged) return;
		e.preventDefault();
		list = [...node.querySelectorAll<HTMLElement>('[data-sort-id]')];
		mids = list.map((el) => {
			const r = el.getBoundingClientRect();
			return r.top + r.height / 2;
		});
		from = to = list.indexOf(dragged);
		startY = e.clientY;
		pointerId = e.pointerId;
		node.setPointerCapture(pointerId);
		Object.assign(dragged.style, {
			position: 'relative',
			zIndex: '10',
			boxShadow: '0 6px 20px rgb(0 0 0 / 0.18)'
		});
		for (const el of list) if (el !== dragged) el.style.transition = 'transform 150ms';
	}

	function move(e: PointerEvent) {
		if (!dragged) return;
		const dy = e.clientY - startY;
		dragged.style.transform = `translateY(${dy}px)`;
		const y = mids[from] + dy;
		to = mids.filter((m, i) => i !== from && m < y).length;
		const h = dragged.offsetHeight;
		list.forEach((el, i) => {
			if (el === dragged) return;
			const shift =
				from < to && i > from && i <= to ? -h : from > to && i >= to && i < from ? h : 0;
			el.style.transform = shift ? `translateY(${shift}px)` : '';
		});
	}

	function up() {
		if (!dragged) return;
		for (const el of list) {
			el.style.transform = '';
			el.style.transition = '';
		}
		Object.assign(dragged.style, { position: '', zIndex: '', boxShadow: '' });
		dragged = null;
		if (node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
		if (from !== to) {
			const ids = list.map((el) => el.dataset.sortId!);
			const [moved] = ids.splice(from, 1);
			ids.splice(to, 0, moved);
			onsort(ids);
		}
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', up);
	return {
		update(fn: (ids: string[]) => void) {
			onsort = fn;
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
		}
	};
}
