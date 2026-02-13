// offscreen.js - Relay between Background and Sandbox

console.log('Offscreen script loaded.');
const sandbox = document.getElementById('sandbox');
const pendingRequests = new Map();
let isSandboxReady = false;
let sandboxReadyQueue = [];

window.addEventListener('message', (event) => {
    if (event.data.action === 'SANDBOX_READY') {
        console.log('Offscreen received SANDBOX_READY');
        isSandboxReady = true;
        sandboxReadyQueue.forEach(fn => fn());
        sandboxReadyQueue = [];
    } else if (event.data.action === 'COMPILE_RESULT') {
        const { id, success, data, error } = event.data;
        console.log('Offscreen received COMPILE_RESULT for ID:', id, 'Success:', success);
        const resolve = pendingRequests.get(id);
        if (resolve) {
            resolve({ success, data, error });
            pendingRequests.delete(id);
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'OFFSCREEN_COMPILE_TYPST') {
        console.log('Offscreen received OFFSCREEN_COMPILE_TYPST');
        const id = Math.random().toString(36).substring(7);

        const process = () => {
            console.log('Offscreen relaying to sandbox for ID:', id);
            pendingRequests.set(id, (res) => sendResponse(res));
            sandbox.contentWindow.postMessage({
                action: 'COMPILE_TYPST',
                source: request.source,
                assets: request.assets,
                font: request.font,
                wasmUrl: request.wasmUrl,
                id: id
            }, '*');
        };

        if (isSandboxReady) {
            process();
        } else {
            console.log('Offscreen waiting for sandbox to be ready for ID:', id);
            sandboxReadyQueue.push(process);
        }

        return true; // Keep message channel open
    }
});
