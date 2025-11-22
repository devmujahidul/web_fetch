const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_URL = 'https://raw.githubusercontent.com/devmujahidul/Auto_Fetch/refs/heads/main/output.json';

app.use(cors());

// Helper function to fetch with VLC headers
async function fetchWithVLCHeaders(url) {
    return await axios.get(url, {
        headers: {
            'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Origin': 'https://web.aynaott.com',
            'Referer': 'https://web.aynaott.com/'
        },
        responseType: 'text'
    });
}

// Helper function to rewrite M3U8 content
function rewriteM3U8(content, baseUrl, proxyPath) {
    const lines = content.split('\n');
    const newLines = lines.map(line => {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) return line;
        
        try {
            // Convert relative/absolute URLs to absolute URLs
            const absoluteUrl = new URL(trimmedLine, baseUrl).toString();
            
            // If it's another M3U8 file, proxy it through our server
            if (trimmedLine.includes('.m3u8')) {
                const encodedUrl = encodeURIComponent(absoluteUrl);
                return `${proxyPath}/proxy-m3u8?url=${encodedUrl}`;
            }
            
            // For .ts files, proxy them too to avoid CORS issues
            if (trimmedLine.includes('.ts')) {
                const encodedUrl = encodeURIComponent(absoluteUrl);
                return `${proxyPath}/proxy-segment?url=${encodedUrl}`;
            }
            
            // Return absolute URL for other files
            return absoluteUrl;
        } catch (e) {
            return line;
        }
    });
    
    return newLines.join('\n');
}

// Main endpoint - returns the master playlist
app.get('/get-stream/:id', async (req, res) => {
    const requestedId = req.params.id;

    try {
        // 1. Get URL from JSON
        const jsonResponse = await axios.get(DATA_URL);
        const channel = jsonResponse.data.channels.find(item => item.id === requestedId);

        if (!channel) return res.status(404).send("Channel ID not found");

        const targetUrl = channel.url;
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

        // 2. Fetch master playlist
        const streamResponse = await fetchWithVLCHeaders(targetUrl);

        // 3. Rewrite M3U8 to proxy all requests through our server
        // Always use HTTPS for Render deployment
        const protocol = req.get('host').includes('localhost') ? req.protocol : 'https';
        const host = req.get('host');
        const proxyPath = `${protocol}://${host}`;
        
        const finalM3u8 = rewriteM3U8(streamResponse.data, baseUrl, proxyPath);

        // 4. Send response
        res.set({
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
        });
        
        res.send(finalM3u8);

    } catch (error) {
        console.error("Proxy Error:", error.response ? error.response.status : error.message);
        
        if (error.response && error.response.status === 403) {
            res.status(403).send("Access Denied: The token in the JSON file is likely IP-locked to the GitHub server and cannot be used on this network.");
        } else {
            res.status(500).send("Error fetching stream");
        }
    }
});

// Proxy endpoint for nested M3U8 files
app.get('/proxy-m3u8', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send("Missing URL parameter");
    }

    try {
        const decodedUrl = decodeURIComponent(targetUrl);
        const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);
        
        // Fetch the nested M3U8
        const streamResponse = await fetchWithVLCHeaders(decodedUrl);
        
        // Rewrite URLs in this M3U8 too
        // Always use HTTPS for Render deployment
        const protocol = req.get('host').includes('localhost') ? req.protocol : 'https';
        const host = req.get('host');
        const proxyPath = `${protocol}://${host}`;
        
        const finalM3u8 = rewriteM3U8(streamResponse.data, baseUrl, proxyPath);
        
        res.set({
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
        });
        
        res.send(finalM3u8);
        
    } catch (error) {
        console.error("M3U8 Proxy Error:", error.message);
        res.status(500).send("Error fetching M3U8");
    }
});

// Proxy endpoint for .ts segments
app.get('/proxy-segment', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send("Missing URL parameter");
    }

    try {
        const decodedUrl = decodeURIComponent(targetUrl);
        
        // Fetch the .ts segment
        const segmentResponse = await axios.get(decodedUrl, {
            headers: {
                'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
                'Accept': '*/*',
                'Connection': 'keep-alive',
                'Origin': 'https://web.aynaott.com',
                'Referer': 'https://web.aynaott.com/'
            },
            responseType: 'stream'
        });
        
        // Set appropriate headers
        res.set({
            'Content-Type': 'video/mp2t',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
        });
        
        // Pipe the stream directly to response
        segmentResponse.data.pipe(res);
        
    } catch (error) {
        console.error("Segment Proxy Error:", error.message);
        res.status(500).send("Error fetching segment");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});