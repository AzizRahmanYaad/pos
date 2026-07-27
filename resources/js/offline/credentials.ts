import type { AuthUser } from '@/features/auth/api';

const STORE_KEY = 'asan-hesab:offline-credential';

interface StoredCredential {
    userId: number;
    email: string;
    salt: string;
    iterations: number;
    hash: string;
    user: AuthUser;
    savedAt: number;
}

/**
 * How long a device may let somebody in without the server having seen the
 * password. Long enough to cover a real outage, short enough that a stolen
 * till does not stay usable indefinitely.
 */
const MAX_OFFLINE_DAYS = 30;

const ITERATIONS = 150_000;

function toHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The password is never stored, here or anywhere. What is kept is a slow,
 * salted hash of it — the same thing a server keeps — so the device can
 * recognise the right password without being able to reveal it.
 */
async function derive(password: string, saltHex: string, iterations: number): Promise<string> {
    const encoder = new TextEncoder();
    const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));

    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);

    return toHex(bits);
}

/** Remember this sign-in so the same person can get back in with no line. */
export async function rememberCredential(email: string, password: string, user: AuthUser): Promise<void> {
    try {
        if (!crypto?.subtle) return;

        const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
        const hash = await derive(password, salt, ITERATIONS);

        const credential: StoredCredential = {
            userId: user.id,
            email: email.trim().toLowerCase(),
            salt,
            iterations: ITERATIONS,
            hash,
            user,
            savedAt: Date.now(),
        };

        window.localStorage.setItem(STORE_KEY, JSON.stringify(credential));
    } catch {
        // Without this the user simply cannot sign in during an outage.
    }
}

/**
 * Let the last person who signed in on this device back in, when the server
 * cannot be asked. Returns the account as the server last described it —
 * permissions and all — so the app knows what they may do.
 */
export async function signInOffline(email: string, password: string): Promise<AuthUser | null> {
    try {
        if (!crypto?.subtle) return null;

        const raw = window.localStorage.getItem(STORE_KEY);

        if (!raw) return null;

        const credential = JSON.parse(raw) as StoredCredential;

        if (credential.email !== email.trim().toLowerCase()) return null;

        if (Date.now() - credential.savedAt > MAX_OFFLINE_DAYS * 86_400_000) return null;

        const hash = await derive(password, credential.salt, credential.iterations);

        // Constant-time-ish: compare the whole string, never bail early.
        if (hash.length !== credential.hash.length) return null;

        let mismatch = 0;

        for (let i = 0; i < hash.length; i += 1) {
            mismatch |= hash.charCodeAt(i) ^ credential.hash.charCodeAt(i);
        }

        return mismatch === 0 ? credential.user : null;
    } catch {
        return null;
    }
}

/** Whether an offline sign-in is even possible on this device. */
export function hasOfflineCredential(): boolean {
    try {
        return window.localStorage.getItem(STORE_KEY) !== null;
    } catch {
        return false;
    }
}
