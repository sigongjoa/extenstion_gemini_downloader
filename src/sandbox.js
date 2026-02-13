import initTypst, { TypstCompilerBuilder } from '@myriaddreamin/typst-ts-web-compiler';

console.log('Sandbox script loaded.');

window.addEventListener('message', async (event) => {
    const { action, source, assets, font, wasmUrl, id } = event.data;

    if (action === 'COMPILE_TYPST') {
        console.log('Sandbox starting compilation for ID:', id);
        try {
            await initTypst(wasmUrl);
            const builder = new TypstCompilerBuilder();

            // Add font if provided
            if (font) {
                try {
                    const binary = atob(font);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    await builder.add_raw_font(bytes);
                    console.log('Sandbox: Font added successfully');
                } catch (fontErr) {
                    console.error('Sandbox: Failed to add font', fontErr);
                }
            }

            const compiler = await builder.build();

            // Map assets (images) to virtual filesystem
            if (assets) {
                for (const [path, b64Data] of Object.entries(assets)) {
                    try {
                        const binary = atob(b64Data);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                        compiler.map_shadow(path, bytes);
                        console.log(`Mapped asset: ${path} (${bytes.length} bytes)`);
                    } catch (assetErr) {
                        console.error(`Failed to map asset ${path}:`, assetErr);
                    }
                }
            }

            compiler.add_source('/main.typ', source);
            const result = compiler.compile('/main.typ', undefined, 'pdf', 0);

            console.log('Sandbox compilation successful for ID:', id);

            // Convert result (Uint8Array) to Base64 for safe transfer
            let binary = '';
            const len = result.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(result[i]);
            }
            const base64Result = btoa(binary);

            window.parent.postMessage({
                action: 'COMPILE_RESULT',
                success: true,
                data: base64Result,
                id: id
            }, '*');
        } catch (err) {
            console.error('Sandbox compilation error for ID:', id, err);
            window.parent.postMessage({
                action: 'COMPILE_RESULT',
                success: false,
                error: (err.message || String(err)) + '\n' + (err.stack || ''),
                id: id
            }, '*');
        }
    }
});

// Signal that we are ready
window.parent.postMessage({ action: 'SANDBOX_READY' }, '*');
console.log('Sandbox signaled ready.');
