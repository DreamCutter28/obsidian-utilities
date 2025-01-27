const folder = 'your/folder/path'; // Specify your folder with notes
const templatesFolder = 'templates'; // Specify your templates folder path

const files = dv.pages(`"${folder}"`);
const templates = dv.pages(`"${templatesFolder}"`);

let emptyNotes = [];

const templateContents = [];
for (const template of templates) {
   const content = await app.vault.read(app.vault.getAbstractFileByPath(template.file.path));
   const cleanContent = content.replace(/^---[\s\S]*?---/, '').trim();
   templateContents.push(cleanContent);
}

for (const file of files) {
   const content = await app.vault.read(app.vault.getAbstractFileByPath(file.file.path));
   const cleanContent = content.replace(/^---[\s\S]*?---/, '').trim();
   
   if (cleanContent === '' || templateContents.includes(cleanContent)) {
       emptyNotes.push(file.file.link);
   }
}

// Display results
dv.header(3, `Empty notes and template copies (${emptyNotes.length})`);
dv.list(emptyNotes);