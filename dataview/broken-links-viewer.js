const config = {
    folders: [],           // Empty array = search entire vault
    exclude: [],          // Folders to exclude
    navigationType: 'advanced-uri',  // 'advanced-uri' or 'search'
};

// Check if required Obsidian APIs are available
function validateEnvironment() {
    if (!app?.vault || !app?.metadataCache || !app?.workspace) {
        throw new Error("Required Obsidian APIs are unavailable");
    }
}

// Check if path should be processed based on include/exclude filters
function isPathAllowed(path) {
    const isIncluded = config.folders.length === 0 || 
                      config.folders.some(folder => path.startsWith(folder));
    const isExcluded = config.exclude.some(folder => path.startsWith(folder));
    return isIncluded && !isExcluded;
}

// Get all possible formats for a link
function getLinkFormats(link) {
    const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(link);
    return isImage 
        ? [`![](${link})`, `![[${link}]]`, link]
        : [`[[${link}]]`, `[${link}]`, link];
}

// Find the position of a broken link in the file
async function findLinkPosition(filePath, linkText) {
    try {
        const content = await dv.io.load(filePath);
        const cache = app.metadataCache.getCache(filePath);
        const unresolvedLinks = app.metadataCache.unresolvedLinks[filePath] || {};
        
        if (!content || !cache) return null;

        // Clean link text
        const cleanLink = linkText.replace(/^\[+|\]+$/g, '').trim();
        
        // First try finding in metadata cache
        if (cache.links || cache.embeds) {
            const allRefs = [...(cache.links || []), ...(cache.embeds || [])];
            const match = allRefs.find(ref => {
                const refText = ref.original.replace(/[\[\]!]/g, '').trim();
                return refText === cleanLink && unresolvedLinks[cleanLink];
            });
            
            if (match?.position?.start?.offset !== undefined) {
                return {
                    offset: match.position.start.offset,
                    line: content.slice(0, match.position.start.offset).split('\n').length
                };
            }
        }

        // Fallback to text search
        const formats = getLinkFormats(cleanLink);
        for (const format of formats) {
            const lastIndex = content.lastIndexOf(format);
            if (lastIndex !== -1) {
                return {
                    offset: lastIndex,
                    line: content.slice(0, lastIndex).split('\n').length
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
            const uri = `obsidian://advanced-uri`
                + `?vault=${vaultName}`
                + `&filepath=${encodedPath}`
                + `&mode=source`
                + `&line=${position.line}`
                + `&offset=${position.offset}`;

            return `[${linkText}](${uri})`;
        }
        
        // Fallback to search
        const query = encodeURIComponent(`path:"${filePath}" "${linkText}"`);
        return `[${linkText}](obsidian://search?query=${query})`;
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
        const unresolvedLinks = Object.entries(app.metadataCache.unresolvedLinks)
            .filter(([path, links]) => 
                Object.keys(links).length > 0 && isPathAllowed(path)
            );

        // Process each file
        const tableData = await Promise.all(unresolvedLinks.map(async ([path, links]) => {
            const brokenLinks = await Promise.all(
                Object.keys(links).map(async link => {
                    const pos = await findLinkPosition(path, link);
                    return createNavigationLink(path, pos, link);
                })
            );
            
            return [
                dv.fileLink(path),
                brokenLinks.join(", ")
            ];
        }));

        // Display results
        dv.table(
            ["File", "Broken Links"], 
            tableData
        );
    } catch (error) {
        console.error('Error during broken links search:', error);
    }
}

// Run
await findBrokenLinks();