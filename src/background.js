import JSZip from 'jszip';
import { Converter } from './converter.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PROCESS_DOWNLOAD') {
        processDownload(request.data)
            .then(() => sendResponse({ success: true }))
            .catch(err => {
                console.error("Process download error:", err);
                sendResponse({ success: false, error: err.message });
            });
        return true; // Async response
    }
});

async function processDownload(data) {
    const converter = new Converter(data);
    const imageMap = converter.processImages(); // Sets initial base filenames

    const assets = new Map();
    const finalExtensions = new Map();

    const getExtFromMime = (mime) => {
        if (!mime) return 'png';
        if (mime.includes('webp')) return 'webp';
        if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
        if (mime.includes('gif')) return 'gif';
        if (mime.includes('png')) return 'png';
        return 'png';
    };

    // 1. Collect all local images from content script
    const localImages = new Map();
    data.messages.forEach(turn => {
        if (turn.imageBlobs) {
            turn.imageBlobs.forEach(img => {
                localImages.set(img.url, img.base64);
            });
        }
    });

    // 2. Fetch/Process all images to find correct extensions
    const allImageUrls = Array.from(imageMap.keys());
    const fetchPromises = allImageUrls.map(async (url) => {
        try {
            if (localImages.has(url)) {
                const b64 = localImages.get(url);
                const mime = b64.split(':')[1]?.split(';')[0];
                const ext = getExtFromMime(mime);
                finalExtensions.set(url, ext);

                const base64Content = b64.split(',')[1];
                const binary = atob(base64Content);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                assets.set(url, bytes.buffer);
            } else {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const contentType = response.headers.get('Content-Type');
                const ext = getExtFromMime(contentType);
                finalExtensions.set(url, ext);
                const buffer = await response.arrayBuffer();
                assets.set(url, buffer);
            }
        } catch (e) {
            console.error(`Failed to fetch image ${url}:`, e);
        }
    });

    await Promise.all(fetchPromises);

    // 3. Apply final extensions to converter
    converter.setExtensions(finalExtensions);

    // 4. Build ZIP and Typst assets with correct filenames
    const zip = new JSZip();
    const imgFolder = zip.folder("images");
    const typstAssets = new Map();

    for (const [url, buffer] of assets.entries()) {
        const filename = converter.getFilename(url);
        if (filename) {
            imgFolder.file(filename, buffer);
            typstAssets.set(`/images/${filename}`, buffer);
        }
    }

    // 5. Generate MD and Typst with final filenames
    const markdown = converter.toMarkdown();
    zip.file("conversation.md", markdown);

    const typstSource = converter.toTypst();
    zip.file("conversation.typ", typstSource);

    // 6. Final PDF compilation
    try {
        const pdfBlob = await compileTypstToPdf(typstSource, typstAssets);
        zip.file("conversation.pdf", pdfBlob);
    } catch (e) {
        console.error("Typst compilation failed:", e);
        zip.file("typst_error.txt", `${e.message}\n${e.stack || ''}`);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const reader = new FileReader();
    reader.readAsDataURL(content);
    return new Promise((resolve, reject) => {
        reader.onloadend = () => {
            chrome.downloads.download({
                url: reader.result,
                filename: `${sanitizeFilename(data.title)}.zip`,
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve(downloadId);
            });
        };
        reader.onerror = reject;
    });
}

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function compileTypstToPdf(source, assets) {
    console.log('Background: Starting PDF compilation...');
    // 1. Ensure offscreen document exists
    await setupOffscreenDocument('src/offscreen.html');

    // 2. Send source and assets to offscreen document
    const wasmUrl = chrome.runtime.getURL('lib/typst_compiler_bg.wasm');
    const fontUrl = chrome.runtime.getURL('fonts/NanumGothic.ttf');

    // Fetch font once per compilation (or could be cached)
    let fontB64 = "";
    try {
        const fontRes = await fetch(fontUrl);
        const fontBuffer = await fontRes.arrayBuffer();
        fontB64 = bufferToBase64(fontBuffer);
    } catch (e) {
        console.error("Failed to fetch font:", e);
    }

    // Convert assets Map to an object with Base64 strings for robust serialization
    const assetsObj = {};
    if (assets) {
        for (const [path, buffer] of assets.entries()) {
            assetsObj[path] = bufferToBase64(buffer);
        }
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('PDF compilation timed out (30s)'));
        }, 30000);

        chrome.runtime.sendMessage({
            action: 'OFFSCREEN_COMPILE_TYPST',
            source: source,
            assets: assetsObj,
            font: fontB64,
            wasmUrl: wasmUrl
        }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
                console.error('Background: sendMessage error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            console.log('Background: Received response from offscreen:', response ? 'Success=' + response.success : 'NULL');

            if (response && response.success) {
                try {
                    // response.data is a Base64 string
                    const binary = atob(response.data);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    resolve(new Blob([bytes], { type: 'application/pdf' }));
                } catch (e) {
                    console.error('Background: Data conversion error:', e);
                    reject(new Error('Failed to parse PDF data: ' + e.message));
                }
            } else {
                const errMsg = response ? (typeof response.error === 'string' ? response.error : JSON.stringify(response.error)) : 'Unknown offscreen error';
                console.error('Background: Compilation failed:', errMsg);
                reject(new Error(errMsg));
            }
        });
    });
}

function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

let creating; // A global promise to avoid race conditions
async function setupOffscreenDocument(path) {
    // Check all windows controlled by the service worker to see if one 
    // of them is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['DOM_PARSER'], // Best fit reason for general logic
            justification: 'Compiling Typst to PDF requires a DOM-enabled context with sandbox support for WASM glue.'
        });
        await creating;
        creating = null;
    }
}
