import { registerPlugin } from '../capacitor-core.js';
const Filesystem = registerPlugin('Filesystem', {
    web: () => import('./web.js').then(m => new m.FilesystemWeb()),
});
export * from './definitions.js';
export { Filesystem };
//# sourceMappingURL=index.js.map