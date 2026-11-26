import { describe, expect, it } from 'vitest';
import { visibleLinks } from './navbarFilter';

describe('visibleLinks', () => {
    it('hides admin-only links from other accounts', () => {
        const links = [{ link: '/a' }, { link: '/r', adminOnly: true }];
        expect(visibleLinks(links, { administrator: false, visionEnabled: false }).map(l => l.link)).toEqual(['/a']);
        expect(visibleLinks(links, { administrator: true, visionEnabled: false }).map(l => l.link)).toEqual(['/a', '/r']);
    });

    it('hides vision links until the server reports analysis enabled', () => {
        const links = [{ link: '/a' }, { link: '/v', adminOnly: true, requiresVision: true }];
        expect(visibleLinks(links, { administrator: true, visionEnabled: false }).map(l => l.link)).toEqual(['/a']);
        expect(visibleLinks(links, { administrator: true, visionEnabled: true }).map(l => l.link)).toEqual(['/a', '/v']);
        expect(visibleLinks(links, { administrator: false, visionEnabled: true }).map(l => l.link)).toEqual(['/a']);
    });
});
