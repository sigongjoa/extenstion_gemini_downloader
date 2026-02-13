
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

        // 1. Detect and preserve Math blocks
        // Delimiters: $$...$$, \[...\], \(...\), $...$
        const mathBlocks = [];
        let processed = text;

        // Replace math blocks with placeholders
        // Order matters: check for double delimiters first
        const blockPatterns = [
            { regex: /\$\$([\s\S]+?)\$\$/g, isBlock: true },
            { regex: /\\\[([\s\S]+?)\\\]/g, isBlock: true },
            { regex: /\\\(([\s\S]+?)\\\)/g, isBlock: false },
            { regex: /\$([^\$]+?)\$/g, isBlock: false }
        ];

        blockPatterns.forEach((pattern, pIdx) => {
            processed = processed.replace(pattern.regex, (match, formula) => {
                const id = `__MATH_${mathBlocks.length}__`;
                mathBlocks.push({ id, formula, isBlock: pattern.isBlock });
                return id;
            });
        });

        // 2. Escape the remaining text part
        processed = this.escapeTypst(processed);

        // 3. Convert Markdown Bold (** -> *)
        // Note: After escaping, ** becomes \*\*
        processed = processed.replace(/\\\*\\\*/g, "*");

        // 4. Convert preserved math to Typst math syntax and put back
        mathBlocks.forEach(block => {
            let typstMath = this.latexToTypstMath(block.formula);
            // Typst inline math is $ formula $, block math is $ formula $ but usually handled by surrounding whitespace or styling
            // For block math in Typst, we can wrap it in a block() or just ensure it's on a new line.
            const wrapper = block.isBlock ? "\n$ " + typstMath + " $\n" : "$ " + typstMath + " $";
            processed = processed.replace(block.id, wrapper);
        });

        // 4. Preserve newlines: double newline -> paragraph, single -> forced newline
        processed = processed
            .replace(/\n\n/g, "\n\n")
            .replace(/(?<!\n)\n(?!\n)/g, " \\\n");

        return processed;
    }

    latexToTypstMath(latex) {
        if (!latex) return "";

        // Basic LaTeX to Typst math conversion
        // This is an MVP conversion, not a full parser.
        let converted = latex
            .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
            .replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)')
            .replace(/\\sqrt\s*\[([^\[\]]+)\]\s*\{([^{}]+)\}/g, 'root($1, $2)')
            .replace(/\\times/g, ' times ')
            .replace(/\\cdot/g, ' dot ')
            .replace(/\\alpha/g, ' alpha ')
            .replace(/\\beta/g, ' beta ')
            .replace(/\\gamma/g, ' gamma ')
            .replace(/\\delta/g, ' delta ')
            .replace(/\\epsilon/g, ' epsilon ')
            .replace(/\\zeta/g, ' zeta ')
            .replace(/\\eta/g, ' eta ')
            .replace(/\\theta/g, ' theta ')
            .replace(/\\iota/g, ' iota ')
            .replace(/\\kappa/g, ' kappa ')
            .replace(/\\lambda/g, ' lambda ')
            .replace(/\\mu/g, ' mu ')
            .replace(/\\nu/g, ' nu ')
            .replace(/\\xi/g, ' xi ')
            .replace(/\\pi/g, ' pi ')
            .replace(/\\rho/g, ' rho ')
            .replace(/\\sigma/g, ' sigma ')
            .replace(/\\tau/g, ' tau ')
            .replace(/\\upsilon/g, ' upsilon ')
            .replace(/\\phi/g, ' phi ')
            .replace(/\\chi/g, ' chi ')
            .replace(/\\psi/g, ' psi ')
            .replace(/\\omega/g, ' omega ')
            .replace(/\\Sigma/g, ' Sigma ')
            .replace(/\\Delta/g, ' Delta ')
            .replace(/\\Phi/g, ' Phi ')
            .replace(/\\Omega/g, ' Omega ')
            .replace(/\\pm/g, ' plus.minus ')
            .replace(/\\mp/g, ' minus.plus ')
            .replace(/\\neq/g, ' != ')
            .replace(/\\leq/g, ' <= ')
            .replace(/\\geq/g, ' >= ')
            .replace(/\\approx/g, ' approx ')
            .replace(/\\infty/g, ' oo ')
            .replace(/\\partial/g, ' partial ')
            .replace(/\\nabla/g, ' nabla ')
            .replace(/\\int/g, ' integral ')
            .replace(/\\sum/g, ' sum ')
            .replace(/\\prod/g, ' product ')
            .replace(/\\left\(/g, '(')
            .replace(/\\right\)/g, ')')
            .replace(/\\left\[/g, '[')
            .replace(/\\right\]/g, ']')
            .replace(/\\left\{/g, '{')
            .replace(/\\right\}/g, '}')
            .replace(/\\text\{([^{}]+)\}/g, '"$1"')
            .replace(/\\limits/g, '') // Typst handles limits
            .replace(/\{/g, '(')
            .replace(/\}/g, ')');

        return converted;
    }
}
