
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Shreeji Software\\Downloads\\c-shreejisoftware1\\frontend\\src\\pages\\tasks\\TaskDetailPage.tsx', 'utf8');

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('<input') || line.trim().startsWith('<textarea')) {
        let tagStr = "";
        let j = i;
        while (j < lines.length) {
            tagStr += lines[j].trim() + " ";
            if (lines[j].includes('>') || lines[j].includes('/>')) break;
            j++;
        }
        
        const hasTitle = tagStr.includes('title=') || tagStr.includes('title={');
        const hasPlaceholder = tagStr.includes('placeholder=') || tagStr.includes('placeholder={');
        const hasAria = tagStr.includes('aria-label=') || tagStr.includes('aria-label={');
        
        if (!hasTitle && !hasPlaceholder && !hasAria) {
            console.log(`REAL UNLABELED [line ${i + 1}]: ${tagStr}`);
        }
    }
}
