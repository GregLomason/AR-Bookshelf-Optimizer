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

        // Handle window resize and orientation changes
        window.addEventListener('resize', () => this.handleOrientationChange());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        });
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
                    // Wait a bit for video to fully load then resize
                    setTimeout(() => {
                        this.resizeCanvas();
                        this.updateUILayout();
                        resolve();
                    }, 100);
                };
            });
        } catch (error) {
            console.error('❌ Camera initialization failed:', error);
            this.updateStatus('Camera Access Failed', 'error');
        }
    }

    handleOrientationChange() {
        console.log('🔄 Handling orientation change...');
        setTimeout(() => {
            this.resizeCanvas();
            this.updateUILayout();
        }, 200); // Allow time for orientation to settle
    }
    
    resizeCanvas() {
        if (!this.video || !this.canvas) return;
        
        const videoRect = this.video.getBoundingClientRect();
        const containerRect = this.video.parentElement.getBoundingClientRect();
        
        // Set canvas size to match actual displayed video size
        this.canvas.width = videoRect.width;
        this.canvas.height = videoRect.height;
        
        // Position canvas to perfectly overlay the video
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = videoRect.left - containerRect.left + 'px';
        this.canvas.style.top = videoRect.top - containerRect.top + 'px';
        this.canvas.style.width = videoRect.width + 'px';
        this.canvas.style.height = videoRect.height + 'px';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '10';
        
        console.log('📐 Canvas sized:', {
            canvas: { w: this.canvas.width, h: this.canvas.height },
            video: { w: videoRect.width, h: videoRect.height },
            position: { x: videoRect.left - containerRect.left, y: videoRect.top - containerRect.top }
        });
    }
    
    updateUILayout() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const controls = document.querySelector('.controls');
        const detectionInfo = document.querySelector('.detection-info');
        
        if (isLandscape) {
            // Landscape mode: move controls to side
            if (controls) {
                controls.style.bottom = '20px';
                controls.style.right = '20px';
                controls.style.left = 'auto';
                controls.style.transform = 'none';
                controls.style.flexDirection = 'column';
                controls.style.gap = '10px';
            }
            
            if (detectionInfo) {
                detectionInfo.style.top = '20px';
                detectionInfo.style.right = '20px';
                detectionInfo.style.transform = 'none';
            }
        } else {
            // Portrait mode: restore default positions
            if (controls) {
                controls.style.bottom = '20px';
                controls.style.left = '50%';
                controls.style.right = 'auto';
                controls.style.transform = 'translateX(-50%)';
                controls.style.flexDirection = 'row';
                controls.style.gap = '15px';
            }
            
            if (detectionInfo) {
                detectionInfo.style.top = '50%';
                detectionInfo.style.right = '20px';
                detectionInfo.style.transform = 'translateY(-50%)';
            }
        }
        
        console.log('📱 UI layout updated for:', isLandscape ? 'landscape' : 'portrait');
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
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        console.log(`📷 Frame captured: ${imageData.width}x${imageData.height}`);
        return imageData;
    }

    renderAR(books, suggestions) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate proper scaling based on actual video display vs internal resolution
        const videoRect = this.video.getBoundingClientRect();
        const scaleX = videoRect.width / this.video.videoWidth || 1;
        const scaleY = videoRect.height / this.video.videoHeight || 1;
        
        console.log(`🎯 AR rendering: ${books.length} books, scale: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}, canvas: ${this.canvas.width}x${this.canvas.height}`);

        // Debug: log first few book positions for alignment check
        if (books.length > 0) {
            console.log(`📖 First book pos: x=${books[0].x}, y=${books[0].y}, w=${books[0].width}, scaled: x=${books[0].x * scaleX}, y=${books[0].y * scaleY}`);
        }
        
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

        // Spine-focused detection box (tighter fit)
        const spineMargin = 2;
        const adjustedX = x + spineMargin;
        const adjustedWidth = Math.max(width - spineMargin * 2, 4);
        
        // Main spine outline
        this.ctx.strokeStyle = book.stable ? '#4ade80' : '#fbbf24';
        this.ctx.lineWidth = book.stable ? 2 : 1.5;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(adjustedX, y, adjustedWidth, height);
        
        // Book spine left and right edges (more precise)
        this.ctx.strokeStyle = book.confidence > 0.6 ? '#22c55e' : '#84cc16';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(adjustedX, y);
        this.ctx.lineTo(adjustedX, y + height);
        this.ctx.moveTo(adjustedX + adjustedWidth, y);
        this.ctx.lineTo(adjustedX + adjustedWidth, y + height);
        this.ctx.stroke();
        
        // Confidence indicator (smaller, less intrusive)
        if (book.confidence > 0.3) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            const badgeWidth = Math.min(adjustedWidth, 45);
            this.ctx.fillRect(adjustedX, y - 16, badgeWidth, 14);
            
            this.ctx.fillStyle = book.stable ? '#4ade80' : '#fbbf24';
            this.ctx.font = '10px monospace';
            const confText = `${Math.round(book.confidence * 100)}%`;
            this.ctx.fillText(confText, adjustedX + 2, y - 6);
        }
        
        // Book index number (for debugging)
        if (book.id && book.confidence > 0.4) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = '8px Arial';
            const bookNum = book.id.split('_').pop() || '?';
            this.ctx.fillText(bookNum, adjustedX + adjustedWidth - 10, y + 12);
        }
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