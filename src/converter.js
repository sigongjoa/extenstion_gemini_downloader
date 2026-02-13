
export class Converter {
    constructor(data) {
        this.data = data;
        this.images = new Map(); // Map url -> filename
        this.imageCounter = 1;
    }

    // Generate unique base filenames for images
    processImages() {
        this.data.messages.forEach(msg => {
            if (msg.images && msg.images.length > 0) {
                msg.images.forEach(url => {
                    if (!this.images.has(url)) {
                        const filenameStr = `image_${this.imageCounter++}`;
                        this.images.set(url, { base: filenameStr, ext: 'png' }); // Default to png
                    }
                });
            }
        });
        return this.images;
    }

    setExtensions(extensionMap) {
        for (const [url, ext] of extensionMap.entries()) {
            if (this.images.has(url)) {
                this.images.get(url).ext = ext;
            }
        }
    }

    getFilename(url) {
        const info = this.images.get(url);
        return info ? `${info.base}.${info.ext}` : null;
    }

    toMarkdown() {
        let md = `# ${this.data.title}\n\n`;
        md += `*Exported: ${this.data.timestamp}*\n\n---\n\n`;

        this.data.messages.forEach(msg => {
            const role = msg.role === 'user' ? 'User' : 'Model';
            md += `### ${role}\n\n`;

            if (msg.content) {
                md += `${msg.content}\n\n`;
            }

            if (msg.images && msg.images.length > 0) {
                msg.images.forEach(url => {
                    const filename = this.getFilename(url);
                    md += `![Image](images/${filename})\n\n`;
                });
            }

            md += `---\n\n`;
        });

        return md;
    }

    toTypst() {
        // Basic Typst template structure
        let typ = `
#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2cm),
  numbering: "1",
)
#set text(
  font: "NanumGothic",
  size: 11pt,
  lang: "ko" 
)
#set par(
  justify: true,
  leading: 0.65em,
)

// Define custom block styles
#let user_block(body) = {
  block(
    fill: rgb("#f0f4f8"),
    inset: 12pt,
    radius: 4pt,
    width: 100%,
    body
  )
}

#let model_block(body) = {
  block(
    fill: white,
    stroke: (left: 2pt + rgb("#e0e0e0")),
    inset: (left: 12pt, top: 6pt, bottom: 6pt),
    width: 100%,
    body
  )
}

#align(center, text(17pt, weight: "bold")[${this.escapeTypst(this.data.title)}])
#align(center, text(10pt, style: "italic")[Exported: ${this.escapeTypst(this.data.timestamp)}])
#v(1cm)

`;

        this.data.messages.forEach(msg => {
            const isUser = msg.role === 'user';
            const content = this.formatTypstContent(msg.content);

            if (isUser) {
                typ += `#user_block[\n*User*:\n\n${content}\n`;
            } else {
                typ += `#model_block[\n*Model*:\n\n${content}\n`;
            }

            if (msg.images && msg.images.length > 0) {
                typ += `\n#grid(columns: (1fr), gutter: 1em,\n`;
                msg.images.forEach(url => {
                    const filename = this.getFilename(url);
                    // Typst image syntax
                    typ += `  image("/images/${filename}", width: 80%),\n`;
                });
                typ += `)\n`;
            }

            typ += `]\n#v(0.5cm)\n`;
        });

        return typ;
    }

    escapeTypst(text) {
        if (!text) return "";
        return text
            .replace(/\\/g, "\\\\")
            .replace(/~/g, "\\~")
            .replace(/_/g, "\\_")
            .replace(/\*/g, "\\*")
            .replace(/"/g, '\\"')
            .replace(/#/g, "\\#")
            .replace(/\$/g, "\\$")
            .replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]")
            .replace(/\{/g, "\\{")
            .replace(/\}/g, "\\}");
    }

    formatTypstContent(text) {
        if (!text) return "";

        // 1. Basic preprocessing: handle bold (Markdown ** -> Typst *)
        // Note: We escape everything else, so we do this carefully.
        let processed = text;

        // 2. Escape special Typst characters
        processed = this.escapeTypst(processed);

        // 3. Preserve newlines: double newline -> paragraph, single -> forced newline
        // In Typst markup, a backslash at the end of a line is a forced newline.
        // We can also just replace \n with \n\n if we want paragraphs, 
        // but innerText often has many \n.
        // Let's try to map \n to \  (backslash space) for single newlines
        // and preserve \n\n as actual paragraph breaks.
        processed = processed
            .replace(/\n\n/g, "\n\n") // Paragraphs stay paragraphs
            .replace(/(?<!\n)\n(?!\n)/g, " \\\n"); // Single \n -> forced newline

        return processed;
    }
}
