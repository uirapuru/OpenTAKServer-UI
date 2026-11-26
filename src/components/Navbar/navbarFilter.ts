interface FilterableLink {
    adminOnly?: boolean;
    requiresVision?: boolean;
}

// TakLab: pozycje tylko dla administratora, a część dodatkowo wymaga włączonej analizy wideo.
export function visibleLinks<T extends FilterableLink>(
    links: T[],
    opts: { administrator: boolean; visionEnabled: boolean },
): T[] {
    return links.filter((item) => {
        if (item.adminOnly && !opts.administrator) return false;
        if (item.requiresVision && !opts.visionEnabled) return false;
        return true;
    });
}
