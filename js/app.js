/**
 * Main Application Module
 * Orchestrates the AR Bookshelf Optimizer
 */

import BookDetectionController from './book-detection-controller.js';

class ARBookshelfOptimizer {
    constructor() {
        this.detectionController = new BookDetectionController();
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.animationFrame = null;
        this.isRunning = false;
        this.lastUpdateTime = 0;
        this.updateInterval = 300; // 300ms for smooth performance
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing AR Bookshelf Optimizer...');
        
        // Get DOM elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('arCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start camera
        await this.initCamera();
        
        // Start detection loop
        this.startDetection();
        
        console.log('✅ AR Bookshelf Optimizer initialized');
    }

    setupEventListeners() {
        const stopBtn = document.getElementById('stopBtn');
        const switchBtn = document.getElementById('switchBtn');
        const infoBtn = document.getElementById('infoBtn');

        stopBtn.addEventListener('click', () => this.toggleDetection());
        switchBtn.addEventListener('click', () => this.switchCamera());
        infoBtn.addEventListener('click', () => this.showInfo());

        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    async initCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment', // Rear camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.resizeCanvas();
                    resolve();
                };
            });
        } catch (error) {
            console.error('❌ Camera initialization failed:', error);
            this.updateStatus('Camera Access Failed', 'error');
        }
    }

    resizeCanvas() {
        if (this.video.videoWidth && this.video.videoHeight) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            console.log('📐 Canvas resized to:', this.canvas.width + 'x' + this.canvas.height);
        } else {
            // Fallback dimensions
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            console.log('📐 Canvas fallback size:', this.canvas.width + 'x' + this.canvas.height);
        }
        
        // Set canvas style to match video
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
    }

    startDetection() {
        this.isRunning = true;
        this.updateStatus('Live Analysis Active', 'active');
        this.detectionLoop();
    }

    stopDetection() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.updateStatus('Analysis Stopped', 'stopped');
    }

    toggleDetection() {
        if (this.isRunning) {
            this.stopDetection();
            document.getElementById('stopBtn').innerHTML = '<span class="btn-icon">▶</span>Start Analysis';
        } else {
            this.startDetection();
            document.getElementById('stopBtn').innerHTML = '<span class="btn-icon">⏸</span>Stop Analysis';
        }
    }

    async detectionLoop() {
        if (!this.isRunning) return;

        const now = Date.now();
        
        if (now - this.lastUpdateTime >= this.updateInterval) {
            await this.performDetection();
            this.lastUpdateTime = now;
        }

        this.animationFrame = requestAnimationFrame(() => this.detectionLoop());
    }

    async performDetection() {
        if (!this.video.videoWidth || !this.video.videoHeight) {
            console.log('⏳ Video not ready yet, skipping detection...');
            return;
        }

        try {
            console.log('🎥 Capturing frame for detection...');
            // Capture current frame
            const imageData = this.captureFrame();
            console.log('📷 Frame captured:', imageData.width + 'x' + imageData.height);
            
            // Perform detection
            const results = await this.detectionController.detectBooks(imageData);
            console.log('🔍 Detection completed:', results.books.length, 'books found');
            
            // Update UI
            this.updateStats(results.stats);
            this.renderAR(results.books, results.suggestions);
            
            // Update detection method display
            document.getElementById('detectionMethod').textContent = results.detectionType;
            
        } catch (error) {
            console.error('❌ Detection error:', error);
            this.updateStatus('Detection Error', 'error');
        }
    }

    captureFrame() {
        // Create temporary canvas for frame capture
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.video.videoWidth;
        tempCanvas.height = this.video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw current video frame
        tempCtx.drawImage(this.video, 0, 0);
        
        // Get image data
        return tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }

    renderAR(books, suggestions) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Scale factors for canvas vs video
        const scaleX = this.canvas.width / this.video.videoWidth;
        const scaleY = this.canvas.height / this.video.videoHeight;

        // Render book detection boxes
        books.forEach(book => {
            this.drawBookDetection(book, scaleX, scaleY);
        });

        // Render AR suggestions
        suggestions.forEach(suggestion => {
            this.drawARSuggestion(suggestion, scaleX, scaleY);
        });
    }

    drawBookDetection(book, scaleX, scaleY) {
        const x = book.x * scaleX;
        const y = book.y * scaleY;
        const width = book.width * scaleX;
        const height = book.height * scaleY;

        // Detection box
        this.ctx.strokeStyle = book.stable ? '#4ade80' : '#fbbf24';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x, y, width, height);

        // Confidence badge
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(x, y - 20, 60, 18);
        
        this.ctx.fillStyle = book.stable ? '#4ade80' : '#fbbf24';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`${Math.round(book.confidence * 100)}%`, x + 5, y - 8);

        // Reset line dash
        this.ctx.setLineDash([]);
    }

    drawARSuggestion(suggestion, scaleX, scaleY) {
        const x = suggestion.x * scaleX;
        const y = suggestion.y * scaleY;

        // Suggestion box
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.strokeStyle = '#fbbf24';
        this.ctx.lineWidth = 1;
        
        const boxWidth = 140;
        const boxHeight = 35;
        
        this.ctx.fillRect(x, y - boxHeight/2, boxWidth, boxHeight);
        this.ctx.strokeRect(x, y - boxHeight/2, boxWidth, boxHeight);

        // Suggestion text
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.font = 'bold 11px Arial';
        this.ctx.fillText(suggestion.text, x + 5, y - 8);
        
        this.ctx.fillStyle = '#4ade80';
        this.ctx.font = '9px Arial';
        this.ctx.fillText(suggestion.efficiency, x + 5, y + 8);
    }

    updateStats(stats) {
        document.getElementById('bookCount').textContent = stats.booksFound;
        document.getElementById('spaceUsed').textContent = `${stats.spaceUsed}%`;
        document.getElementById('potentialGain').textContent = `+${stats.potentialGain}%`;
    }

    updateStatus(text, type) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        
        statusText.textContent = text;
        
        statusDot.className = 'status-dot';
        if (type === 'error') {
            statusDot.style.background = '#ef4444';
        } else if (type === 'stopped') {
            statusDot.style.background = '#6b7280';
        } else {
            statusDot.style.background = '#4ade80';
        }
    }

    async switchCamera() {
        // Implementation for camera switching
        console.log('🔄 Camera switching not implemented yet');
    }

    showInfo() {
        alert(`AR Bookshelf Optimizer

Detection Method: ${this.detectionController.getDetectionMethod()}
Books Found: ${document.getElementById('bookCount').textContent}
Space Used: ${document.getElementById('spaceUsed').textContent}

This app uses MCP servers for accurate book detection and provides spatial optimization suggestions.`);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ARBookshelfOptimizer();
});

// Export for debugging
window.ARBookshelfOptimizer = ARBookshelfOptimizer;