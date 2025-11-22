# Production HLS Player Integration Guide

## ✅ Verified Working Configuration

The test player confirms the stream works. If your production player doesn't work, follow this guide.

---

## 🔍 Common Issues & Solutions

### Issue 1: HTTPS/HTTP Mixed Content ⚠️ MOST COMMON
**Symptom**: Stream works in test but not production  
**Cause**: Production site is HTTPS, trying to load HTTP stream  
**Fix**: Always use HTTPS URL
```javascript
const streamUrl = 'https://web-fetch-xn7m.onrender.com/get-stream/YOUR_CHANNEL_ID';
```

---

### Issue 2: HLS.js Configuration
**Symptom**: Player shows error or doesn't start  
**Cause**: Incorrect HLS.js setup  
**Fix**: Use this exact configuration

```html
<!-- Include HLS.js library -->
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<video id="video" controls></video>

<script>
const video = document.getElementById('video');
const streamUrl = 'https://web-fetch-xn7m.onrender.com/get-stream/YOUR_CHANNEL_ID';

if (Hls.isSupported()) {
    const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        xhrSetup: function(xhr, url) {
            xhr.withCredentials = false;
        }
    });
    
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    
    hls.on(Hls.Events.MANIFEST_PARSED, function() {
        console.log('Stream loaded successfully');
        video.play().catch(e => {
            console.log('Autoplay prevented, user interaction required');
        });
    });
    
    hls.on(Hls.Events.ERROR, function(event, data) {
        console.error('HLS Error:', data);
        
        if (data.fatal) {
            switch(data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    console.error('Network error - retrying...');
                    hls.startLoad();
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    console.error('Media error - recovering...');
                    hls.recoverMediaError();
                    break;
                default:
                    console.error('Fatal error - cannot recover');
                    hls.destroy();
                    break;
            }
        }
    });
} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS support (Safari, iOS)
    video.src = streamUrl;
    video.addEventListener('loadedmetadata', function() {
        video.play();
    });
}
</script>
```

---

### Issue 3: Autoplay Policy
**Symptom**: Stream loads but doesn't play automatically  
**Cause**: Browser autoplay restrictions  
**Fix**: Either require user interaction OR use muted autoplay

```javascript
// Option 1: Muted autoplay (works automatically)
video.muted = true;
video.play().catch(e => console.log('Autoplay failed'));

// Option 2: Require user click (more reliable)
playButton.addEventListener('click', () => {
    video.play();
});
```

---

### Issue 4: Video.js Integration
**If using Video.js instead of pure HLS.js:**

```html
<link href="https://vjs.zencdn.net/8.6.1/video-js.css" rel="stylesheet" />
<script src="https://vjs.zencdn.net/8.6.1/video.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/videojs-contrib-hls@latest"></script>

<video id="video" class="video-js vjs-default-skin" controls></video>

<script>
const player = videojs('video', {
    html5: {
        vhs: {
            withCredentials: false
        }
    }
});

player.src({
    src: 'https://web-fetch-xn7m.onrender.com/get-stream/YOUR_CHANNEL_ID',
    type: 'application/x-mpegURL'
});

player.play();
</script>
```

---

### Issue 5: Plyr Integration
**If using Plyr:**

```html
<link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
<script src="https://cdn.plyr.io/3.7.8/plyr.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<video id="player" controls></video>

<script>
const video = document.getElementById('player');
const streamUrl = 'https://web-fetch-xn7m.onrender.com/get-stream/YOUR_CHANNEL_ID';

if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    
    hls.on(Hls.Events.MANIFEST_PARSED, function() {
        const player = new Plyr(video);
    });
} else {
    const player = new Plyr(video);
    video.src = streamUrl;
}
</script>
```

---

## 🐛 Debugging Checklist

### Browser Console Checks:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors containing:
   - `CORS`
   - `Mixed Content`
   - `HLS Error`
   - `Network Error`

### Network Tab Checks:
1. Go to Network tab
2. Filter by `XHR` or `All`
3. Look for these requests:
   - `/get-stream/YOUR_ID` - Should return 200 OK
   - `/proxy-m3u8?url=...` - Should return 200 OK
   - `/proxy-segment?url=...` - Should return 200 OK

4. Check response headers:
   ```
   Content-Type: application/vnd.apple.mpegurl
   Access-Control-Allow-Origin: *
   ```

### Common Error Messages:

| Error | Cause | Fix |
|-------|-------|-----|
| `Mixed Content` | HTTPS site loading HTTP | Use HTTPS stream URL |
| `CORS policy` | Server not sending CORS headers | Already fixed in server.js |
| `manifestLoadError` | Can't fetch M3U8 | Check URL is correct |
| `fragLoadError` | Can't fetch segments | Server proxy issue |
| `levelLoadError` | Can't load quality level | Check `/proxy-m3u8` endpoint |

---

## 📱 Mobile Considerations

### iOS/Safari:
- Has native HLS support
- No need for HLS.js
- Use direct video source:
```javascript
if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
}
```

### Android:
- Requires HLS.js
- May have stricter autoplay policies
- Use muted autoplay or play button

---

## 🎯 React Integration

```jsx
import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

function VideoPlayer({ streamUrl }) {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (Hls.isSupported()) {
            const hls = new Hls({
                xhrSetup: (xhr) => {
                    xhr.withCredentials = false;
                }
            });
            
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(console.error);
            });
            
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });
            
            hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
        };
    }, [streamUrl]);

    return (
        <video 
            ref={videoRef} 
            controls 
            style={{ width: '100%', maxWidth: '800px' }}
        />
    );
}

export default VideoPlayer;
```

---

## 🎯 Vue Integration

```vue
<template>
  <video ref="videoPlayer" controls></video>
</template>

<script>
import Hls from 'hls.js';

export default {
  props: {
    streamUrl: {
      type: String,
      required: true
    }
  },
  
  mounted() {
    this.initPlayer();
  },
  
  beforeUnmount() {
    if (this.hls) {
      this.hls.destroy();
    }
  },
  
  methods: {
    initPlayer() {
      const video = this.$refs.videoPlayer;
      
      if (Hls.isSupported()) {
        this.hls = new Hls({
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          }
        });
        
        this.hls.loadSource(this.streamUrl);
        this.hls.attachMedia(video);
        
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play();
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = this.streamUrl;
      }
    }
  }
}
</script>
```

---

## 📞 Still Not Working?

If you've tried everything above and it still doesn't work, please provide:

1. **Browser Console Errors** (screenshot or copy-paste)
2. **Network Tab** (show the requests and their status codes)
3. **Your player code** (HTML/JavaScript you're using)
4. **Your site URL** (is it HTTP or HTTPS?)
5. **Player library** (HLS.js version, Video.js, Plyr, etc.)

The stream IS working (confirmed by test player), so it's definitely a player configuration issue.

---

## ✅ Working Test URL

Use this to verify your setup:
```
https://web-fetch-xn7m.onrender.com/get-stream/20714fd4-dc3c-46d6-924f-3038d61f027c
```

If this works in the test player but not yours, compare the two implementations line by line.
