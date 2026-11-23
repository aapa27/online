
const DOCUMENT_ID = "CzL66icd61ElsB86Y1";

// Your deployed Cloudflare Worker URL
const WORKER_URL =
    "https://dontpad-chat.aapa-cdr.workers.dev";

// Read proxy (the one that already worked for you)
const READ_PROXY = "https://proxy.cors.dev/";

const API_URL =
    `https://api.dontpad.com/${DOCUMENT_ID}.body.json?lastModified=0`;

let lastModified = 0;
let messages = [];
let isLoading = false;
let isSending = false;


// DOM ELEMENTS
const messagesElement = document.getElementById("messages");
const statusElement = document.getElementById("status");
const usernameInput = document.getElementById("username");
const colorInput = document.getElementById("usernameColor");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");


// READ CHAT FROM DONTPAD
async function loadChat() {

    if (isLoading) return;

    isLoading = true;

    try {

        const response = await fetch(
            READ_PROXY + API_URL + "&_=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        lastModified = data.lastModified;

        let newMessages = [];

        const body = data.body || "";

        if (body.trim()) {
            newMessages = JSON.parse(body);
        }

        if (!Array.isArray(newMessages)) {
            throw new Error("Invalid chat JSON format");
        }

        // Update only when the conversation changes
        if (JSON.stringify(newMessages) !== JSON.stringify(messages)) {

            messages = newMessages;

            renderMessages();
        }

        statusElement.textContent = "Connected";

    } catch (error) {

        console.error("Chat loading error:", error);

        statusElement.textContent = "Connection error";

    } finally {

        isLoading = false;

    }
}


// DISPLAY MESSAGES
function renderMessages() {

    const wasAtBottom =
        messagesElement.scrollHeight -
        messagesElement.scrollTop -
        messagesElement.clientHeight < 50;

    messagesElement.replaceChildren();

    messages.forEach(message => {

        const container = document.createElement("div");
        container.className = "message";

        const header = document.createElement("div");
        header.className = "message-header";

        const username = document.createElement("span");
        username.className = "username";
        username.textContent = message.name;

        // Validate color before applying it
        const color = /^#[0-9a-fA-F]{6}$/.test(message.color)
            ? message.color
            : "#ffffff";

        username.style.color = color;

        const timestamp = document.createElement("span");
        timestamp.className = "timestamp";

        if (message.timestamp) {
            timestamp.textContent =
                new Date(message.timestamp).toLocaleTimeString();
        }

        const text = document.createElement("div");
        text.className = "message-text";
        text.textContent = message.message;

        header.appendChild(username);
        header.appendChild(timestamp);

        container.appendChild(header);
        container.appendChild(text);

        messagesElement.appendChild(container);

    });

    if (wasAtBottom) {
        messagesElement.scrollTop = messagesElement.scrollHeight;
    }
}


// SEND MESSAGE
async function sendMessage(event) {

    event.preventDefault();

    if (isSending) return;

    const name = usernameInput.value.trim();
    const message = messageInput.value.trim();
    const color = colorInput.value;

    if (!name || !message) {
        alert("Please enter your name and a message.");
        return;
    }

    isSending = true;
    sendButton.disabled = true;

    statusElement.textContent = "Sending...";

    try {

        // Fetch the latest version before appending
        // const readResponse = await fetch(READ_PROXY + API_URL);

        const readResponse = await fetch(
            READ_PROXY + API_URL + "&_=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!readResponse.ok) {
            throw new Error("Could not retrieve latest chat");
        }

        const currentData = await readResponse.json();

        lastModified = currentData.lastModified;

        const body = currentData.body || "";

        const currentMessages = body.trim()
            ? JSON.parse(body)
            : [];

        if (!Array.isArray(currentMessages)) {
            throw new Error("Invalid chat JSON format");
        }

        // Create new message
        const newMessage = {
            name: name,
            color: color,
            message: message,
            timestamp: Date.now()
        };

        currentMessages.push(newMessage);

        // Prepare JSON document
        const updatedContent = JSON.stringify(
            currentMessages,
            null,
            2
        );

        // Send through Cloudflare Worker
        const params = new URLSearchParams();

        params.append("text", updatedContent);
        params.append("lastModified", lastModified);
        params.append("force", "false");

        const saveResponse = await fetch(WORKER_URL, {
            method: "POST",
            body: params
        });

        const result = await saveResponse.text();

        if (!saveResponse.ok) {
            throw new Error(result || `HTTP ${saveResponse.status}`);
        }

        // Clear message input only after successful save
        messageInput.value = "";

        statusElement.textContent = "Message sent!";

        // Immediately refresh the conversation
        await loadChat();

    } catch (error) {

        console.error("Sending error:", error);

        statusElement.textContent =
            "Failed to send: " + error.message;

    } finally {

        isSending = false;
        sendButton.disabled = false;

        messageInput.focus();

    }
}


// FORM SUBMISSION
document
    .getElementById("chatForm")
    .addEventListener("submit", sendMessage);


// AUTOMATIC CHAT REFRESH
loadChat();

setInterval(loadChat, 2000);
