class VideoAnalyzer {
    constructor() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.uploadButton = document.getElementById('uploadButton');
        this.runButton = document.getElementById('runAnalysis');
        this.progressBar = document.getElementById('progressBar');
        this.results = document.getElementById('results');
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
        // Verify file size and type
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            alert('File is too large. Please upload a video smaller than 50MB.');
            return;
        }

        if (!file.type.startsWith('video/')) {
            alert('Please upload a valid video file.');
            return;
        }

        this.currentFile = file;
        
        // Update UI to show selected file
        const dropZone = document.getElementById('dropZone');
        const fileName = document.getElementById('fileName');
        
        dropZone.classList.add('has-file');
        fileName.textContent = file.name;
        
        console.log('Selected file:', {
            name: file.name,
            size: file.size,
            type: file.type
        });
    }

    async analyzeVideo(file) {
        try {
            // Show progress bar
            this.progressBar.hidden = false;
            this.results.hidden = true;
            this.updateProgress(50);

            // Add loading state to upload area
            const dropZone = document.getElementById('dropZone');
            dropZone.style.opacity = '0.7';

            // Create FormData
            const formData = new FormData();
            formData.append('video', file);

            // Upload and analyze video
            const response = await fetch('http://localhost:3000/api/analyze-video', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Analysis failed');
            }

            const data = await response.json();
            this.updateProgress(100);
            this.displayResults(data);

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during analysis. Please try again.');
        } finally {
            this.progressBar.hidden = true;
            // Restore upload area opacity
            const dropZone = document.getElementById('dropZone');
            dropZone.style.opacity = '1';
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

    updateProgress(percent) {
        const progressElement = this.progressBar.querySelector('.progress');
        progressElement.style.width = `${percent}%`;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoAnalyzer();
}); 