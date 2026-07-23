import '@tanstack/react-query';

declare module '@tanstack/react-query' {
    interface Register {
        mutationMeta: {
            /** Shown as a success toast automatically when the mutation resolves. */
            successMessage?: string;
            /** Overrides the toast shown when the mutation fails (falls back to the API's own message). */
            errorMessage?: string;
        };
    }
}
