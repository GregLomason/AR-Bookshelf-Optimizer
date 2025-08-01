/**
 * MCP Server Integration Module
 * Handles communication with ImageSorcery MCP server for computer vision
 */

class MCPBookDetection {
    constructor() {
        // ImageSorcery MCP endpoints
        this.mcpEndpoints = {
            objectDetection: '/mcp/imagesorcery/detect-objects',
            imageProcessing: '/mcp/imagesorcery/process-image'
        };
    }

    async detectBooks(imageData) {
        console.log('🔍 Starting ImageSorcery MCP book detection...');
        
        try {
            // Convert imageData to base64 for MCP server
            const imageBase64 = this.imageDataToBase64(imageData);
            
            // Use ImageSorcery for object detection
            const detectionResults = await this.callImageSorceryDetection(imageBase64);
            console.log('🎯 ImageSorcery detected objects:', detectionResults.length);
            
            return this.processDetections(detectionResults);
            
        } catch (error) {
            console.error('❌ ImageSorcery MCP detection failed:', error);
            throw error;
        }
    }

    imageDataToBase64(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    async callImageSorceryDetection(imageBase64) {
        try {
            const response = await fetch(this.mcpEndpoints.objectDetection, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageBase64,
                    task: 'object_detection',
                    objects: ['book', 'books', 'spine', 'spines'],
                    confidence_threshold: 0.25
                }),
                signal: AbortSignal.timeout(10000) // 10 second timeout for AI processing
            });
            
            if (!response.ok) {
                throw new Error(`ImageSorcery MCP failed: ${response.status} - ${response.statusText}`);
            }
            
            const results = await response.json();
            return results.detections || results.objects || [];
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('ImageSorcery MCP server not available - check if server is running');
            }
            throw error;
        }
    }


    processDetections(detections) {
        const books = [];
        
        detections.forEach((detection, index) => {
            if (this.isValidBookDetection(detection)) {
                // Handle different possible coordinate formats from ImageSorcery
                const bbox = this.normalizeDetectionCoordinates(detection);
                
                books.push({
                    id: `imagesorcery_book_${index}`,
                    x: bbox.x,
                    y: bbox.y,
                    width: bbox.width,
                    height: bbox.height,
                    confidence: detection.confidence || detection.score || 0.7,
                    title: `Book ${books.length + 1}`,
                    isReal: true,
                    spineArea: bbox.width * bbox.height,
                    estimatedThickness: bbox.width * 0.6,
                    canRotate: bbox.height < bbox.width * 3,
                    canStack: bbox.height > 100 && bbox.width < 30,
                    volumeEfficiency: this.calculateVolumeEfficiency(bbox.width, bbox.height),
                    detectionMethod: 'ImageSorcery_MCP',
                    rawDetection: detection
                });
            }
        });
        
        return books;
    }

    normalizeDetectionCoordinates(detection) {
        // Handle various coordinate formats from ImageSorcery
        if (detection.bbox) {
            // Format: {bbox: [x, y, width, height]}
            return {
                x: detection.bbox[0],
                y: detection.bbox[1],
                width: detection.bbox[2],
                height: detection.bbox[3]
            };
        } else if (detection.x !== undefined) {
            // Format: {x, y, width, height}
            return {
                x: detection.x,
                y: detection.y,
                width: detection.width,
                height: detection.height
            };
        } else if (detection.bounds) {
            // Format: {bounds: {left, top, right, bottom}}
            return {
                x: detection.bounds.left,
                y: detection.bounds.top,
                width: detection.bounds.right - detection.bounds.left,
                height: detection.bounds.bottom - detection.bounds.top
            };
        }
        
        // Fallback format
        return {
            x: detection.left || 0,
            y: detection.top || 0,
            width: detection.right - detection.left || 50,
            height: detection.bottom - detection.top || 100
        };
    }

    isValidBookDetection(detection) {
        const bbox = this.normalizeDetectionCoordinates(detection);
        const confidence = detection.confidence || detection.score || 0.7;
        
        const aspectRatio = bbox.height / bbox.width;
        const isBookSized = bbox.width > 10 && bbox.width < 100 && bbox.height > 60 && bbox.height < 400;
        const isBookRatio = aspectRatio > 1.2 && aspectRatio < 8;
        const isConfident = confidence > 0.2;
        
        // Also check if it's labeled as a book/spine
        const isBookLabeled = detection.label && (
            detection.label.toLowerCase().includes('book') ||
            detection.label.toLowerCase().includes('spine')
        );
        
        return (isBookSized && isBookRatio && isConfident) || isBookLabeled;
    }

    calculateVolumeEfficiency(width, height) {
        const aspectRatio = height / width;
        const idealRatio = 2.5;
        const efficiency = 1 - Math.abs(aspectRatio - idealRatio) / idealRatio;
        return Math.max(0.1, Math.min(0.9, efficiency));
    }
}

export default MCPBookDetection;