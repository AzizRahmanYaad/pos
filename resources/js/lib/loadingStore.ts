import { create } from 'zustand';

interface RequestLoadingState {
    activeRequests: number;
    start: () => void;
    finish: () => void;
}

/** Tracks how many API requests are currently in flight, app-wide, so a
 * single top-of-page progress bar can reflect every operation — from the
 * login POST to the final logout call — without each call site wiring it
 * up individually. */
export const useRequestLoadingStore = create<RequestLoadingState>((set) => ({
    activeRequests: 0,
    start: () => set((state) => ({ activeRequests: state.activeRequests + 1 })),
    finish: () => set((state) => ({ activeRequests: Math.max(0, state.activeRequests - 1) })),
}));
