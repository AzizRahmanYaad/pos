import { create } from 'zustand';

export type ToastSeverity = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
    id: number;
    message: string;
    severity: ToastSeverity;
}

interface ToastState {
    toasts: ToastMessage[];
    show: (message: string, severity?: ToastSeverity) => void;
    dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    show: (message, severity = 'success') =>
        set((state) => ({ toasts: [...state.toasts, { id: nextId++, message, severity }] })),
    dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Queue a toast from anywhere — a mutation's onSuccess/onError, an event handler, etc. */
export function showToast(message: string, severity: ToastSeverity = 'success') {
    useToastStore.getState().show(message, severity);
}
