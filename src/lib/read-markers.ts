type Markers = Record<string, number>;

/**
 * Keeps the read markers a page opened with. Loading the page marks it read, so
 * reloads after live updates would otherwise clear every "new" mark at once.
 * Switching to another scope starts over.
 */
export function openedReadMarkers() {
	let opened: { scopeId: string; markers: Markers } | null = null;
	return (scopeId: string, markers: Markers): Markers => {
		if (opened?.scopeId !== scopeId) opened = { scopeId, markers };
		return opened.markers;
	};
}
