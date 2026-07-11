require('dotenv').config();
const express = require('express');
const { Octokit } = require('@octokit/rest');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// গিটহাব কনফিগারেশন (.env ফাইল থেকে আসবে)
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;       // আপনার গিটহাব ইউজারনেম
const REPO = process.env.GITHUB_REPO;         // প্রথম রিপোজিটরির নাম (যেখানে index.html আছে)
const PATH = 'index.html';                     // ফাইলের পাথ

// অ্যাডমিন পেজ রেন্ডার
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// গিটহাব থেকে বর্তমান লিংকগুলো নিয়ে আসার API
app.get('/api/links', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        
        // START_LINKS এবং END_LINKS এর ভেতরের অ্যারে এক্সট্র্যাক্ট করা হচ্ছে
        const match = content.match(/\/\/ START_LINKS\s*const videoLinks = (\[[\s\S]*?\]);\s*\/\/ END_LINKS/);
        
        if (match) {
            const links = JSON.parse(match[1].replace(/'/g, '"'));
            return res.json({ success: true, links });
        }
        res.status(400).json({ success: false, message: 'লিংক ব্লক খুঁজে পাওয়া যায়নি!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// গিটহাবে নতুন লিংক আপডেট করার API
app.post('/api/links', async (req, res) => {
    const { links } = req.body;
    if (!Array.isArray(links)) {
        return res.status(400).json({ success: false, message: 'ভুল ডাটা ফরম্যাট!' });
    }

    try {
        // ১. বর্তমান ফাইল ও তার SHA কি আনা
        const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        
        // ২. নতুন টেক্সট তৈরি করা
        const formattedLinks = `// START_LINKS\n        const videoLinks = ${JSON.stringify(links, null, 12).replace(/"/g, '"')};\n        // END_LINKS`;
        
        const updatedContent = content.replace(
            /\/\/ START_LINKS[\s\S]*?\/\/ END_LINKS/,
            formattedLinks
        );

        // ৩. গিটহাবে ফাইল আপডেট পুশ করা
        await octokit.repos.createOrUpdateFileContents({
            owner: OWNER,
            repo: REPO,
            path: PATH,
            message: 'অ্যাডমিন প্যানেল থেকে ভিডিও লিংক আপডেট করা হয়েছে',
            content: Buffer.from(updatedContent).toString('base64'),
            sha: data.sha
        });

        res.json({ success: true, message: 'গিটহাবে সফলভাবে আপডেট করা হয়েছে!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`সার্ভার চলছে http://localhost:${PORT}`));
