
// content.js - Gemini Conversation Extractor

function extractConversation() {
    const conversation = [];

    // Select all turn containers. 
    const turns = document.querySelectorAll('user-query, model-response');

    turns.forEach((turn, index) => {
        const role = turn.tagName.toLowerCase() === 'user-query' ? 'user' : 'model';

        // Extract text content
        let text = turn.innerText;

        // Extract images
        const images = [];
        const imgElements = turn.querySelectorAll('img');

        imgElements.forEach(img => {
            // Filter out small icons or avatars if possible
            if (img.width > 50 || img.height > 50 || img.src.includes('googleusercontent') || img.src.includes('lamda/images')) {
                if (img.src && !img.src.startsWith('data:image/svg')) {
                    images.push(img.src);
                }
            }
        });

        conversation.push({
            role: role,
            content: text, // Changed from 'text' to 'content' to match Converter.js
            images: images,
            timestamp: new Date().toISOString()
        });
    });

    return conversation;
}


// Function to download images as blobs
async function fetchImages(conversation) {
    for (const turn of conversation) {
        turn.imageBlobs = [];
        for (const url of turn.images) {
            // Only fetch blob: or data: URLs in content script context.
            // Normal https: URLs will be fetched in the background script to avoid CORS.
            if (url.startsWith('blob:') || url.startsWith('data:')) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const blob = await response.blob();
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    turn.imageBlobs.push({
                        url: url,
                        base64: base64,
                        mimeType: blob.type
                    });
                } catch (e) {
                    console.error("Failed to fetch local image:", url, e);
                }
            } else {
                console.log("Skipping cross-origin fetch for:", url);
            }
        }
    }
    return conversation;
}


// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "CAPTURE_CONVERSATION") {
        const rawConversation = extractConversation();
        console.log("Captured raw conversation:", rawConversation);

        fetchImages(rawConversation).then(conversationData => {
            sendResponse({
                success: true,
                data: {
                    messages: conversationData,
                    title: document.title,
                    timestamp: new Date().toLocaleString()
                }
            });
        }).catch(err => {
            console.error("Error fetching images:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep channel open for async response
    }
});
