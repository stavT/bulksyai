const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const {VideoIntelligenceServiceClient} = require('@google-cloud/video-intelligence');

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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/analyze-video', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        const client = new VideoIntelligenceServiceClient();
        
        const videoBuffer = req.file.buffer;
        const query = req.body.query || 'Did the drone fail?';

        console.log('Processing video analysis request...');
        
        // Convert video to base64
        const videoContent = videoBuffer.toString('base64');

        const request = {
            inputContent: videoContent,
            features: ['LABEL_DETECTION', 'OBJECT_TRACKING'],
        };

        console.log('Sending request to Google Cloud...');
        const [operation] = await client.annotateVideo(request);
        console.log('Waiting for analysis to complete...');
        const [results] = await operation.promise();

        const analysis = processResults(results, query);
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

function processResults(results, query) {
    // Basic example of processing results
    const labels = results.labelAnnotations || [];
    const relevantLabels = labels.filter(label => 
        label.confidence > 0.7
    ).map(label => ({
        description: label.description,
        confidence: Math.round(label.confidence * 100)
    }));

    return {
        analysis: `Detected ${relevantLabels.length} relevant objects/actions`,
        labels: relevantLabels,
        confidence: relevantLabels.length > 0 
            ? Math.round(relevantLabels.reduce((acc, label) => acc + label.confidence, 0) / relevantLabels.length)
            : 0
    };
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