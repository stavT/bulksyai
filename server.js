const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { VideoIntelligenceServiceClient } = require('@google-cloud/video-intelligence');

const app = express();

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    }
});

// Initialize the Video Intelligence client with explicit credentials
const client = new VideoIntelligenceServiceClient({
    keyFilename: './credentials.json',
    projectId: 'tester-449003'
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/analyze-video', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        console.log('Processing video analysis request...');
        
        const videoBuffer = req.file.buffer;
        const videoContent = videoBuffer.toString('base64');

        const request = {
            inputContent: videoContent,
            features: [
                'LABEL_DETECTION',
                'SHOT_CHANGE_DETECTION',
                'OBJECT_TRACKING',
                'EXPLICIT_CONTENT_DETECTION'
            ],
            videoContext: {
                segments: [{
                    startTimeOffset: { seconds: '0' },
                    endTimeOffset: { seconds: '300' } // analyze up to 5 minutes
                }]
            }
        };

        console.log('Sending request to Google Cloud...');
        const [operation] = await client.annotateVideo(request);
        console.log('Waiting for analysis to complete...');
        const [results] = await operation.promise();

        // Process and format the results
        const analysis = processResults(results);
        console.log('Analysis complete');

        res.json(analysis);
    } catch (error) {
        console.error('Error during video analysis:', error);
        res.status(500).json({ 
            error: 'Analysis failed',
            details: error.message 
        });
    }
});

function processResults(results) {
    let description = 'Timeline Analysis:\n\n';
    let timeline = [];

    if (results.labelAnnotations) {
        results.labelAnnotations.forEach(label => {
            label.segments.forEach(segment => {
                const startTime = Math.round(segment.startTimeOffset?.seconds || 0);
                const endTime = Math.round(segment.endTimeOffset?.seconds || 0);
                timeline.push({
                    time: startTime,
                    event: `${label.entity.description} detected`,
                    confidence: Math.round(segment.confidence * 100)
                });
            });
        });
    }

    if (results.objectAnnotations) {
        results.objectAnnotations.forEach(obj => {
            obj.frames.forEach(frame => {
                const timeOffset = Math.round(frame.timeOffset?.seconds || 0);
                timeline.push({
                    time: timeOffset,
                    event: `${obj.entity.description} tracked`,
                    confidence: Math.round(frame.confidence * 100)
                });
            });
        });
    }

    if (results.shotAnnotations) {
        results.shotAnnotations.forEach((shot, index) => {
            const startTime = Math.round(shot.startTimeOffset.seconds || 0);
            timeline.push({
                time: startTime,
                event: `New scene detected`,
                confidence: 100
            });
        });
    }

    timeline.sort((a, b) => a.time - b.time);
    
    timeline.forEach(event => {
        description += `${event.time}s: ${event.event} (${event.confidence}% confidence)\n`;
    });

    if (timeline.length === 0) {
        description += "No significant events detected in the video.\n";
    }

    return {
        analysis: description,
        confidence: calculateOverallConfidence(results.labelAnnotations || [])
    };
}

function calculateOverallConfidence(labels) {
    if (labels.length === 0) return 0;
    const sum = labels.reduce((acc, label) => acc + (label.segments[0].confidence || 0), 0);
    return Math.round((sum / labels.length) * 100);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something broke!',
        details: err.message
    });
}); 