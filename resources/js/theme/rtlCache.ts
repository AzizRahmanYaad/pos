import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';

export function createEmotionCache(direction: 'ltr' | 'rtl') {
    return createCache({
        key: direction === 'rtl' ? 'muirtl' : 'mui',
        stylisPlugins: direction === 'rtl' ? [prefixer, rtlPlugin] : [prefixer],
    });
}
