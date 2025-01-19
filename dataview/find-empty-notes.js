const folder = 'your/folder/path'; // Specify your folder with notes
const files = dv.pages(`"${folder}"`);

let emptyNotes = [];

for (const file of files) {
    const content = await app.vault.read(app.vault.getAbstractFileByPath(file.file.path));

    // Remove frontmatter (if any)
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---/, '').trim();

    // If the content is empty after removing the frontmatter, add the file to the list
    if (withoutFrontmatter === '') {
        emptyNotes.push(file.file.link); // Add the file link
    }
}

// Display the list of links
dv.list(emptyNotes);