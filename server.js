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
console.log('Initializing Video Intelligence client...');
const client = new VideoIntelligenceServiceClient({
    keyFilename: './credentials.json',
    projectId: 'tester-449003'
});

// Verify client initialization
console.log('Client initialized with project:', client.projectId);
console.log('Using credentials from:', path.resolve('./credentials.json'));

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
        console.log('Video file size:', req.file.size, 'bytes');
        console.log('Video mime type:', req.file.mimetype);

        const videoBuffer = req.file.buffer;
        const videoContent = videoBuffer.toString('base64');

        // Verify we have video content
        if (!videoContent) {
            throw new Error('Video content is empty');
        }
        console.log('Video content length:', videoContent.length, 'characters');

        // Add more features for comprehensive analysis
        const request = {
            inputContent: videoContent,
            features: [
                'LABEL_DETECTION',
                'OBJECT_TRACKING',
                'SHOT_CHANGE_DETECTION'
            ],
            videoContext: {
                segments: [{
                    startTimeOffset: { seconds: '0' },
                    endTimeOffset: { seconds: '60' }  // analyze up to 1 minute
                }]
            }
        };

        console.log('Sending request to Google Cloud...');
        console.log('API Endpoint:', client.apiEndpoint);
        console.log('Project ID:', client.projectId);

        try {
            console.log('Initiating video analysis...');
            const [operation] = await client.annotateVideo(request);
            console.log('Operation ID:', operation.name);
            console.log('Waiting for operation to complete...');

            const [results] = await operation.promise();
            console.log('Analysis completed. Results structure:', Object.keys(results));
            if (results.annotationResults) {
                console.log('Annotation types received:', 
                    Object.keys(results.annotationResults[0] || {})
                );
            }

            if (!results || !results.annotationResults || results.annotationResults.length === 0) {
                throw new Error('Invalid response from Video Intelligence API');
            }

            // Process and format the results
            const analysis = processResults(results);
            console.log('Analysis complete');

            res.json(analysis);
        } catch (error) {
            console.error('Error processing video:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error during video analysis:', error);
        res.status(500).json({ 
            error: 'Analysis failed',
            details: error.message,
            stack: error.stack
        });
    }
});

// Helper function to convert seconds to ISO 8601 duration format (HH:mm:ss)
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    const parts = [];
    if (hours > 0) {
        parts.push(hours.toString().padStart(2, '0'));
    }
    parts.push(minutes.toString().padStart(2, '0'));
    parts.push(remainingSeconds.toString().padStart(2, '0'));
    
    return parts.join(':');
}

function processResults(results) {
    let description = 'Timeline Analysis:\n\n';
    let timeline = [];

    // Get the first annotation result
    const annotations = results.annotationResults[0];
    const totalDuration = annotations.segment?.endTimeOffset?.seconds || 0;
    console.log('Processing video of length:', formatTime(totalDuration));

    console.log('Processing label annotations...');
    if (annotations.segmentLabelAnnotations) {
        console.log(`Found ${annotations.segmentLabelAnnotations.length} labels`);
        annotations.segmentLabelAnnotations.forEach(label => {
            console.log(`Processing label: ${label.entity.description}`);
            label.segments.forEach(segment => {
                const startTime = Math.round(segment.startTimeOffset?.seconds || 0);
                const endTime = Math.round(segment.endTimeOffset?.seconds || 0);
                timeline.push({
                    time: startTime,
                    event: `${label.entity.description} detected (until ${formatTime(endTime)})`,
                    confidence: Math.round(segment.confidence * 100)
                });
            });
        });
    }

    console.log('Processing object annotations...');
    if (annotations.objectAnnotations) {
        console.log('Processing object: OBJECT_TRACKING');
        annotations.objectAnnotations.forEach(obj => {
            console.log(`Processing object: ${obj.entity.description}`);
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

    // Process person detection annotations
    if (annotations.personDetectionAnnotations) {
        console.log('Processing person detections...');
        annotations.personDetectionAnnotations.forEach(person => {
            person.tracks.forEach(track => {
                const startTime = Math.round(track.segment?.startTimeOffset?.seconds || 0);
                const endTime = Math.round(track.segment?.endTimeOffset?.seconds || 0);
                timeline.push({
                    time: startTime,
                    event: `Person detected (until ${formatTime(endTime)})`,
                    confidence: Math.round(track.confidence * 100)
                });
            });
        });
    }

    // Process speech transcriptions
    if (annotations.speechTranscriptions) {
        console.log('Processing speech transcriptions...');
        annotations.speechTranscriptions.forEach(transcription => {
            console.log(`Processing speech: "${transcription.alternatives[0].transcript}"`);
            transcription.alternatives.forEach(alternative => {
                if (alternative.words) {
                    console.log(`Processing word: "${alternative.words[0].wordInfo.word}"`);
                    alternative.words.forEach(wordInfo => {
                        const startTime = Math.round(wordInfo.startTime?.seconds || 0);
                        timeline.push({
                            time: startTime,
                            event: `Speech: "${alternative.transcript}"`,
                            confidence: Math.round(alternative.confidence * 100)
                        });
                    });
                }
            });
        });
    }

    if (annotations.shotAnnotations) {
        console.log('Processing shot changes...');
        annotations.shotAnnotations.forEach((shot, index) => {
            const startTime = Math.round(shot.startTimeOffset.seconds || 0);
            const endTime = Math.round(shot.endTimeOffset.seconds || 0);
            timeline.push({
                time: startTime,
                event: `New scene detected (until ${formatTime(endTime)})`,
                confidence: 100
            });
        });
    }

    timeline.sort((a, b) => a.time - b.time);
    
    console.log(`Total events detected: ${timeline.length}`);
    console.log('Timeline events:', timeline);
    timeline.forEach(event => {
        description += `${formatTime(event.time)}: ${event.event} (${event.confidence}% confidence)\n`;
    });

    if (timeline.length === 0) {
        console.log('Warning: No events detected in the video');
        description += "No significant events detected in the video.\nThis might be due to:\n" +
                      "- Video quality or length issues\n" +
                      "- Content not matching expected patterns\n" +
                      "- Processing limitations\n";
    }

    return {
        analysis: description,
        confidence: calculateOverallConfidence(annotations.segmentLabelAnnotations || [])
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