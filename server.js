require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Environment Variables থেকে ডেটা নেওয়া (Render-এ সেট করবেন)
const GITHUB_USER = process.env.GITHUB_USER;       // আপনার গিটহাব ইউজারনেম
const GITHUB_REPO = process.env.GITHUB_REPO;       // ১ম রেপোর নাম (যেখানে index.html আছে)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;     // গিটহাব ক্লাসিক টোকেন

const GITHUB_API = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/index.html`;

const getHeaders = () => ({
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Render-Backend-App'
});

// নতুন লিংক যোগ করার API endpoint
app.post('/api/add-video', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL প্রয়োজন' });

    try {
        // ১. ১ম রেপো থেকে index.html ফাইলটি ডাউনলোড করা
        const getRes = await axios.get(GITHUB_API, { headers: getHeaders() });
        const sha = getRes.data.sha;
        let htmlContent = Buffer.from(getRes.data.content, 'base64').toString('utf-8');

        // ২. Regex দিয়ে videoLinks = [ ... ] অংশটি খুঁজে বের করা
        const regex = /const\s+videoLinks\s*=\s*\[([\s\S]*?)\];/;
        const match = htmlContent.match(regex);

        if (!match) {
            return res.status(500).json({ error: "index.html ফাইলে 'const videoLinks' খুঁজে পাওয়া যায়নি!" });
        }

        // ৩. বর্তমান লিংকগুলোর লিস্ট বের করে নতুন লিংকটি যুক্ত করা
        let arrayContent = match[1].trim();
        
        // যদি অলরেডি এই লিংকটি থেকে থাকে, তবে আর যোগ করবে না
        if (arrayContent.includes(url)) {
            return res.status(400).json({ error: 'এই ভিডিও লিংকটি অলরেডি ড্যাশবোর্ডে আছে!' });
        }

        // নতুন লিংকটি ফরম্যাট করে অ্যারের শুরুতে বা শেষে বসানো
        const newLinkString = `"${url}"`;
        if (arrayContent === "") {
            arrayContent = `\n            ${newLinkString}\n        `;
        } else {
            // কমা দিয়ে নতুন লিংক যুক্ত করা
            arrayContent = `\n            ${newLinkString},\n            ` + arrayContent;
        }

        // ৪. নতুন ভিডিও লিস্ট দিয়ে পুরাতন index.html আপডেট করা
        const updatedHtml = htmlContent.replace(regex, `const videoLinks = [${arrayContent}];`);
        const base64Content = Buffer.from(updatedHtml).toString('base64');

        // ৫. ১ম রেপোতে নতুন ফাইলটি Commit/Push করে দেওয়া
        await axios.put(GITHUB_API, {
            message: 'Admin Panel থেকে নতুন ভিডিও যোগ করা হয়েছে',
            content: base64Content,
            sha: sha
        }, { headers: getHeaders() });

        res.json({ success: true, message: '১ম রেপোর index.html-এ ভিডিও সফলভাবে যুক্ত হয়েছে!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'গিটহাবে আপডেট করতে সমস্যা হয়েছে। টোকেন বা রেপো নাম চেক করুন।' });
    }
});

// Render-এর হোমপেজে সাধারণ রেসপন্স
app.get('/', (req, res) => {
    res.send('ভিডিও ড্যাশবোর্ড ব্যাকএন্ড সফলভাবে চালু আছে।');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
