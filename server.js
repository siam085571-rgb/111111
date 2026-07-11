require('dotenv').config();
const express = require('express');
const { Octokit } = require('@octokit/rest');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER;       
const REPO = process.env.GITHUB_REPO;         
const PATH = 'index.html';                     

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// গিটহাব থেকে বর্তমান লিংকগুলো নিয়ে আসার API
app.get('/api/links', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        
        // Regex আরো সহজ করা হলো যাতে স্পেসের জন্য ইরর না আসে
        const match = content.match(/\/\/ START_LINKS[\s\S]*?const videoLinks = (\[[\s\S]*?\]);[\s\S]*?\/\/ END_LINKS/);
        
        if (match) {
            // একক বা ডাবল কোটেশন হ্যান্ডেল করার জন্য ফিক্স
            const linksText = match[1].replace(/'/g, '"').replace(/,\s*\]/, ']');
            const links = JSON.parse(linksText);
            return res.json({ success: true, links });
        }
        res.status(400).json({ success: false, message: 'index.html এ // START_LINKS এবং // END_LINKS ব্লকটি খুঁজে পাওয়া যায়নি!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'গিটহাব থেকে ডাটা আনতে পারেনি', error: error.message });
    }
});

// গিটহাবে নতুন লিংক আপডেট করার API
app.post('/api/links', async (req, res) => {
    const { links } = req.body;
    if (!Array.isArray(links)) {
        return res.status(400).json({ success: false, message: 'ভুল ডাটা ফরম্যাট!' });
    }

    try {
        const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: PATH });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        
        // নতুন ফরম্যাটেড লিংক টেক্সট
        const formattedLinks = `// START_LINKS\n        const videoLinks = ${JSON.stringify(links, null, 12).replace(/"/g, '"')};\n        // END_LINKS`;
        
        const updatedContent = content.replace(
            /\/\/ START_LINKS[\s\S]*?\/\/ END_LINKS/,
            formattedLinks
        );

        await octokit.repos.createOrUpdateFileContents({
            owner: OWNER,
            repo: REPO,
            path: PATH,
            message: 'অ্যাডমিন প্যানেল থেকে ভিডিও লিংক আপডেট করা হয়েছে',
            content: Buffer.from(updatedContent, 'utf-8').toString('base64'),
            sha: data.sha
        });

        res.json({ success: true, message: 'গিটহাবে সফলভাবে আপডেট করা হয়েছে!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'গিটহাবে সেভ করতে সমস্যা হয়েছে', error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`সার্ভার চলছে পোর্ট ${PORT}`));
