// TanStack Query batches cache notifications on a timer; deliver them synchronously in
// tests so state is current right after act() and React doesn't warn about stray updates.
require('@tanstack/react-query').notifyManager.setScheduler((callback) => callback());
