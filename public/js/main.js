class VideoAnalyzer {
    constructor() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.uploadButton = document.getElementById('uploadButton');
        this.runButton = document.getElementById('runAnalysis');
        this.progressBar = document.getElementById('progressBar');
        this.results = document.getElementById('results');
        this.queryInput = document.getElementById('queryInput');
        this.currentFile = null;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Handle Run Analysis button
        this.runButton.addEventListener('click', () => {
            if (this.currentFile) {
                this.analyzeVideo(this.currentFile);
            } else {
                alert('Please upload a video first');
            }
        });

        // Handle drag and drop
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'video/mp4') {
                this.handleFileSelection(file);
            } else {
                alert('Please upload an MP4 file');
            }
        });

        // Handle button click
        this.uploadButton.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Handle file selection
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'video/mp4') {
                this.handleFileSelection(file);
            } else {
                alert('Please upload an MP4 file');
            }
        });
    }

    handleFileSelection(file) {
        this.currentFile = file;
        alert('Video uploaded successfully! Click "Run Analysis" when ready.');
    }

    async analyzeVideo(file) {
        try {
            // Show progress bar
            this.progressBar.hidden = false;
            this.results.hidden = true;

            // Create FormData
            const formData = new FormData();
            formData.append('video', file);
            formData.append('query', this.queryInput.value);

            // Upload and analyze video
            const response = await fetch('http://localhost:3000/api/analyze-video', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Analysis failed');
            }

            const data = await response.json();
            this.displayResults(data);

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during analysis');
        } finally {
            this.progressBar.hidden = true;
        }
    }

    displayResults(data) {
        this.results.hidden = false;
        const resultsContent = this.results.querySelector('.results-content');
        
        resultsContent.innerHTML = `
            <h3>Analysis Results</h3>
            <div class="chat-box">
                <pre>${data.analysis}</pre>
            </div>
            <div class="confidence-score">
                Overall Confidence: ${data.confidence}%
            </div>
        `;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoAnalyzer();
}); 