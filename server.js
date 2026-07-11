require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const GITHUB_USER = process.env.GITHUB_USER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const GITHUB_API = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/videos.json`;

const getHeaders = () => ({
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Node-Express-App'
});

// গিটহাব থেকে লিংক আনা
app.get('/api/videos', async (req, res) => {
    try {
        const response = await axios.get(GITHUB_API, { headers: getHeaders() });
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        res.json(JSON.parse(content));
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.json([]);
        }
        res.status(500).json({ error: 'GitHub থেকে ডেটা আনতে ব্যর্থ হয়েছে' });
    }
});

// গিটহাবে নতুন লিংক যোগ করা
app.post('/api/videos', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL প্রয়োজন' });

    try {
        let sha = null;
        let currentVideos = [];

        try {
            const getRes = await axios.get(GITHUB_API, { headers: getHeaders() });
            sha = getRes.data.sha;
            currentVideos = JSON.parse(Buffer.from(getRes.data.content, 'base64').toString('utf-8'));
        } catch (e) {
            // ফাইল না থাকলে খালি থাকবে
        }

        if (!currentVideos.includes(url)) {
            currentVideos.push(url);
        }

        const updatedContent = Buffer.from(JSON.stringify(currentVideos, null, 2)).toString('base64');

        await axios.put(GITHUB_API, {
            message: 'নতুন লিংক যুক্ত করা হয়েছে',
            content: updatedContent,
            sha: sha
        }, { headers: getHeaders() });

        res.json({ success: true, message: 'লিংক গিটহাবে সফলভাবে সেভ হয়েছে!' });
    } catch (error) {
        res.status(500).json({ error: 'গিটহাবে সেভ করতে সমস্যা হয়েছে' });
    }
});

// মূল রুট বা অন্য যেকোনো রিকোয়েস্টে সরাসরি admin.html লোড হবে (কোনো public ফোল্ডার লাগবে না)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'), (err) => {
        if (err) {
            res.status(404).send("admin.html ফাইলটি রুট ডিরেক্টরিতে খুঁজে পাওয়া যায়নি!");
        }
    });
});

// Render-এর ১০০০০ পোর্টে বাইন্ড করার জন্য
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`সার্ভার চলছে পোর্ট: ${PORT}`));
