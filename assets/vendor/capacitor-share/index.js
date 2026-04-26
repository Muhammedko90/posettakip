import { registerPlugin } from '../capacitor-core.js';
const Share = registerPlugin('Share', {
    web: () => import('./web.js').then(m => new m.ShareWeb()),
});
export * from './definitions.js';
export { Share };
//# sourceMappingURL=index.js.map