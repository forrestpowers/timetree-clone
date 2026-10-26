/**
 * Live updates: an in-process bus that the SSE endpoint relays to browsers, which
 * then re-run the affected page loads. Single-process app, so no broker needed.
 */
import { EventEmitter } from 'node:events';

/** Which client-side data to refresh (each maps to a `depends('app:<kind>')`). */
export type LiveKind = 'events' | 'event' | 'feed' | 'chat' | 'memos' | 'calendars';
export type LiveMessage = {
	calendarId: string;
	kinds: LiveKind[];
	eventId?: string | null;
	actorMemberId?: string | null;
};

const bus = new EventEmitter();
bus.setMaxListeners(1000);

/**
 * Announce a change. Deferred so it runs after the surrounding (synchronous)
 * database transaction has committed.
 */
export function publish(message: LiveMessage) {
	setTimeout(() => bus.emit('change', message), 0);
}

export function subscribe(listener: (message: LiveMessage) => void): () => void {
	bus.on('change', listener);
	return () => bus.off('change', listener);
}
