const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_URL = 'https://raw.githubusercontent.com/devmujahidul/Auto_Fetch/refs/heads/main/output.json';

app.use(cors());

app.get('/get-stream/:id', async (req, res) => {
    const requestedId = req.params.id;

    try {
        // 1. Get URL from JSON
        const jsonResponse = await axios.get(DATA_URL);
        const channel = jsonResponse.data.channels.find(item => item.id === requestedId);

        if (!channel) return res.status(404).send("Channel ID not found");

        const targetUrl = channel.url;
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

        // 2. Fetch stream mimicking VLC Player
        // VLC usually sends very few headers. Sending 'Referer' often causes blocks for these types of tokens.
        const streamResponse = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18', // Pretend to be VLC
                'Accept': '*/*',
                'Connection': 'keep-alive'
            }
        });

        // 3. Rewrite M3U8
        const m3u8Content = streamResponse.data;
        const lines = m3u8Content.split('\n');
        const newLines = lines.map(line => {
            if (!line.trim() || line.trim().startsWith('#')) return line;
            try {
                // Convert relative paths to absolute
                return new URL(line, baseUrl).toString();
            } catch (e) {
                return line;
            }
        });

        const finalM3u8 = newLines.join('\n');

        // 4. Send response
        res.set({
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*'
        });
        
        res.send(finalM3u8);

    } catch (error) {
        console.error("Proxy Error:", error.response ? error.response.status : error.message);
        
        // If we get a 403, it confirms the token is rejected
        if (error.response && error.response.status === 403) {
            res.status(403).send("Access Denied: The token in the JSON file is likely IP-locked to the GitHub server and cannot be used on this network.");
        } else {
            res.status(500).send("Error fetching stream");
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});