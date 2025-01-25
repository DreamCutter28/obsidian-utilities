const config = {
    folders: [], // Empty array = search entire vault
    exclude: [], // Folders to exclude
    navigationType: 'advanced-uri', // 'advanced-uri' or 'search'
};

// Check if required Obsidian APIs are available
function validateEnvironment() {
    if (!app?.vault || !app?.metadataCache || !app?.workspace) {
        throw new Error('Required Obsidian APIs are unavailable');
    }
}

// Check if path should be processed based on include/exclude filters
function isPathAllowed(path) {
    const isIncluded =
        config.folders.length === 0 ||
        config.folders.some((folder) => path.startsWith(folder));
    const isExcluded = config.exclude.some((folder) => path.startsWith(folder));
    return isIncluded && !isExcluded;
}

// Find the position of a broken link in the file
async function findLinkPosition(filePath, linkText) {
    try {
        const content = await dv.io.load(filePath);
        const cache = app.metadataCache.getCache(filePath);

        if (!content || !cache) return null;
        // Find all link formats in the content
        const linkFormats = [
            `[[[${linkText}|`,
            `[[${linkText}|`,
            `[[${linkText}]]`,
            `[${linkText}]`,
            linkText,
        ];
        for (const format of linkFormats) {
            const index = content.indexOf(format);
            if (index !== -1) {
                return {
                    offset: index,
                    line: content.slice(0, index).split('\n').length,
                };
            }
        }
        return null;
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
        return null;
    }
}

// Create navigation link with position
function createNavigationLink(filePath, position, linkText) {
    try {
        const vaultName = encodeURIComponent(app.vault.getName());
        const encodedPath = encodeURIComponent(filePath);

        if (position && config.navigationType === 'advanced-uri') {
            const uri =
                `obsidian://advanced-uri` +
                `?vault=${vaultName}` +
                `&filepath=${encodedPath}` +
                `&mode=source` +
                `&line=${position.line}` +
                `&offset=${position.offset}`;
            return `<a href="${uri}">${linkText}</a>`;
        }

        // Fallback to search
        const query = encodeURIComponent(`path:"${filePath}" "${linkText}"`);
        return `<a href="obsidian://search?query=${query}">${linkText}</a>`;
    } catch (error) {
        console.error(`Error creating navigation link for ${filePath}:`, error);
        return linkText;
    }
}

// Main function to find broken links
async function findBrokenLinks() {
    try {
        validateEnvironment();
        // Get all files with broken links
        const unresolvedLinks = Object.entries(
            app.metadataCache.unresolvedLinks
        ).filter(
            ([path, links]) =>
                Object.keys(links).length > 0 && isPathAllowed(path)
        );
        // Process each file
        const tableData = await Promise.all(
            unresolvedLinks.map(async ([path, links]) => {
                const brokenLinks = await Promise.all(
                    Object.keys(links).map(async (link) => {
                        const pos = await findLinkPosition(path, link);
                        return createNavigationLink(path, pos, link);
                    })
                );

                return [dv.fileLink(path), brokenLinks.join(', ')];
            })
        );
        // Display results
        dv.table(['File', 'Broken Links'], tableData);
    } catch (error) {
        console.error('Error during broken links search:', error);
    }
}

// Run
await findBrokenLinks();