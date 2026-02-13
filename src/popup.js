document.getElementById('downloadBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    const btn = document.getElementById('downloadBtn');

    statusEl.textContent = 'Capturing...';
    btn.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('gemini.google.com')) {
            statusEl.textContent = 'Error: Not a Gemini page.';
            btn.disabled = false;
            return;
        }

        // Capture conversation data from content script
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_CONVERSATION' });

        if (response && response.success) {
            statusEl.textContent = 'Downloading ZIP...';
            // Forward data to background for processing (image fetching, ZIP creation)
            chrome.runtime.sendMessage({
                action: 'PROCESS_DOWNLOAD',
                data: response.data
            }, (res) => {
                if (res && res.success) {
                    statusEl.textContent = 'Success!';
                } else {
                    statusEl.textContent = 'Error during processing.';
                }
                btn.disabled = false;
            });
        } else {
            statusEl.textContent = 'Failed to capture data.';
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        if (err.message.includes("Could not establish connection")) {
            statusEl.textContent = 'Error: Please reload Gemini page.';
        } else {
            statusEl.textContent = 'Internal Error: ' + err.message;
        }
        btn.disabled = false;
    }
});
