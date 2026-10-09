export const THEME_STORAGE_KEY = 'mjp-theme';

/**
 * Runs before first paint (inlined in <head>) so an explicit theme choice never flashes.
 * Without a stored choice the CSS follows prefers-color-scheme.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
