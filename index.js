require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const pdfkit = require('pdfkit');
const { PassThrough } = require('stream');

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

app.post('/api/chat', async (req, res) => {
    const userPrompt = req.body.prompt;
    const uri = 'mongodb://localhost:27017';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('woodhack');
        const usersCollection = db.collection('users');
        const postsCollection = db.collection('posts');

        let queryResult;
        let collectionToQuery;

        if (userPrompt.toLowerCase().includes("hello")) {
            return res.json({ response: "Hi, how can I assist you?" });
        }

        if (userPrompt.toLowerCase().includes("user") || userPrompt.toLowerCase().includes("email") || userPrompt.toLowerCase().includes("username") || userPrompt.toLowerCase().includes("age") || userPrompt.toLowerCase().includes("name")) {
            collectionToQuery = usersCollection;
        } else if (userPrompt.toLowerCase().includes("post") || userPrompt.toLowerCase().includes("content") || userPrompt.toLowerCase().includes("likes") || userPrompt.toLowerCase().includes("date")) {
            collectionToQuery = postsCollection;
        }

        if (collectionToQuery) {
            queryResult = await collectionToQuery.find({}).toArray();
        }

        if (queryResult) {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(`Given the following data, provide a response for the prompt: "${userPrompt}". Data: ${JSON.stringify(queryResult)}`);
            const responseText = await result.response.text();

            // Send the queryResult along with the response
            res.json({ response: responseText, queryResult });
        } else {
            res.json({ response: "No valid query found in AI response." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await client.close();
    }
});

app.post('/api/generate-pdf', (req, res) => {
    const { userPrompt, queryResult } = req.body;

    const doc = new pdfkit();
    const stream = new PassThrough();
    doc.pipe(stream);

    // Add a title and some formatting
    doc.fontSize(18).text('Query Results', { align: 'center' });
    doc.moveDown();
    
    let title;
    if (userPrompt.toLowerCase().includes("user") || userPrompt.toLowerCase().includes("email") || userPrompt.toLowerCase().includes("username") || userPrompt.toLowerCase().includes("age") || userPrompt.toLowerCase().includes("name")) {
        title = 'Users Data';
        doc.fontSize(14).text(title, { underline: true });
        doc.moveDown();
        
        doc.fontSize(12).text('Email\tUsername\tAge\tName', { lineGap: 5 });
        queryResult.forEach(item => {
            doc.text(`${item.email || ''}\t${item.username || ''}\t${item.age || ''}\t${item.name || ''}`, { lineGap: 5 });
        });
    } else if (userPrompt.toLowerCase().includes("post") || userPrompt.toLowerCase().includes("content") || userPrompt.toLowerCase().includes("likes") || userPrompt.toLowerCase().includes("date")) {
        title = 'Posts Data';
        doc.fontSize(14).text(title, { underline: true });
        doc.moveDown();

        doc.fontSize(12).text('Content\tLikes\tDate', { lineGap: 5 });
        queryResult.forEach(item => {
            doc.text(`${item.content || ''}\t${item.likes || ''}\t${item.date || ''}`, { lineGap: 5 });
        });
    }

    doc.end();
    stream.pipe(res);
    res.setHeader('Content-Disposition', `attachment; filename=${userPrompt.replace(/\s+/g, '_')}.pdf`);
});

// Serve the index.html file when accessing the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});












































































