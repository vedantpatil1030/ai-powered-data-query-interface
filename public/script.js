let recognition;
let recognizing = false;

function startSpeechRecognition() {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        let interim_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                document.getElementById('userInput').value += event.results[i][0].transcript;
            } else {
                interim_transcript += event.results[i][0].transcript;
            }
        }
        document.getElementById('userInput').value += interim_transcript;
    };

    recognition.onend = () => {
        if (recognizing) {
            recognition.start();
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
    };

    recognition.start();
}

function stopSpeechRecognition() {
    recognition.stop();
}

function toggleSpeechRecognition() {
    const micButton = document.getElementById('speech-to-text');
    if (recognizing) {
        recognizing = false;
        micButton.innerHTML = '<i class="fas fa-microphone"></i>';
        stopSpeechRecognition();
    } else {
        recognizing = true;
        micButton.innerHTML = '<i class="fas fa-stop"></i>';
        startSpeechRecognition();
    }
}

let currentResponse = '';
let queryResult = [];
let userPrompt = '';

async function sendMessage() {
    userPrompt = document.getElementById('userInput').value;
    if (userPrompt.trim() === "") return;

    const chatBox = document.getElementById('chatBox');
    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    const userMessage = document.createElement('div');
    userMessage.className = 'user-message';
    userMessage.textContent = "You: " + userPrompt;
    chatBox.appendChild(userMessage);

    try {
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: userPrompt }),
        });

        const data = await response.json();

        currentResponse = data.response;
        queryResult = data.queryResult || [];

        const botMessage = document.createElement('div');
        botMessage.className = 'bot-message';
        botMessage.textContent = "Bot: " + currentResponse;
        chatBox.appendChild(botMessage);

        document.getElementById('userInput').value = "";
        chatBox.scrollTop = chatBox.scrollHeight;

        // Show or hide the PDF button based on the presence of queryResult
        document.getElementById('generate-pdf').style.display = queryResult.length > 0 ? 'inline-block' : 'none';
    } catch (error) {
        console.error('Error:', error);
    } finally {
        loading.style.display = 'none';
    }
}

async function generatePDF() {
    if (!queryResult.length) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const headers = Object.keys(queryResult[0] || {});

    // Set PDF title and add it to the document
    doc.setFontSize(18);
    doc.text('Query Results', 14, 22);

    // Calculate column widths
    const columnWidths = headers.map(header => Math.max(header.length * 5, 40)); // Adjust multiplier and minimum width as needed

    // Add a table with headers and data
    doc.autoTable({
        head: [headers],
        body: queryResult.map(row => headers.map(header => row[header] || '')),
        startY: 30, // Starting position for the table
        theme: 'grid', // Table style
        margin: { horizontal: 14 }, // Margins around the table
        headStyles: { fillColor: [22, 160, 133] }, // Header row background color
        styles: { fontSize: 10, cellPadding: 4 }, // Font size and padding for table text
        columnStyles: headers.reduce((styles, header, i) => {
            styles[i] = { cellWidth: columnWidths[i] };
            return styles;
        }, {})
    });

    // Save the PDF
    doc.save(`${userPrompt.replace(/\s+/g, '_')}.pdf`);
}

function handleInput() {
    const queryInput = document.getElementById('userInput');
    const sendButton = document.getElementById('send-query');
    const generatePdfButton = document.getElementById('generate-pdf');
    
    if (queryInput.value.trim() !== '') {
        sendButton.style.display = 'inline-block';
    } else {
        sendButton.style.display = 'none';
    }
}

document.getElementById('userInput').addEventListener('input', handleInput);

