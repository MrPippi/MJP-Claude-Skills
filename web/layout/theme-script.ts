export const THEME_STORAGE_KEY = 'mjp-theme';

/**
 * Runs before first paint (inlined in <head>):
 * - applies an explicit theme choice so it never flashes (otherwise CSS follows prefers-color-scheme);
 * - adds html.motion-ok unless the user prefers reduced motion. Scroll-reveal styles only hide
 *   content under that class, so no-JS visitors and crawlers always see everything.
 */
export const THEME_INIT_SCRIPT = [
  `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`,
  `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion-ok')}catch(e){}`,
].join('');
