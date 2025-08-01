/**
 * MCP Server Integration Module
 * Handles communication with YOLO and OpenCV MCP servers
 */

class MCPBookDetection {
    constructor() {
        this.mcpEndpoints = {
            yolo: '/mcp/yolo/detect',
            opencv: '/mcp/opencv/refine-boundaries'
        };
    }

    async detectBooks(imageData) {
        console.log('🔍 Starting MCP-powered book detection...');
        
        try {
            // Convert imageData to base64 for MCP server
            const imageBase64 = this.imageDataToBase64(imageData);
            
            // Use YOLO MCP for book object detection
            const yoloResults = await this.callYOLOMCP(imageBase64);
            console.log('🎯 YOLO detected objects:', yoloResults.length);
            
            // Use OpenCV MCP for precise boundary refinement
            const openCVResults = await this.callOpenCVMCP(imageBase64, yoloResults);
            console.log('🔧 OpenCV refined boundaries:', openCVResults.length);
            
            return this.processDetections(openCVResults);
            
        } catch (error) {
            console.error('❌ MCP detection failed:', error);
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

    async callYOLOMCP(imageBase64) {
        const response = await fetch(this.mcpEndpoints.yolo, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageBase64,
                classes: ['book'],
                confidence_threshold: 0.3,
                nms_threshold: 0.4
            })
        });
        
        if (!response.ok) {
            throw new Error(`YOLO MCP failed: ${response.status}`);
        }
        
        const results = await response.json();
        return results.detections || [];
    }

    async callOpenCVMCP(imageBase64, yoloDetections) {
        const response = await fetch(this.mcpEndpoints.opencv, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageBase64,
                detections: yoloDetections,
                operations: [
                    'edge_detection',
                    'contour_analysis', 
                    'boundary_refinement'
                ]
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenCV MCP failed: ${response.status}`);
        }
        
        const results = await response.json();
        return results.refined_detections || yoloDetections;
    }

    processDetections(detections) {
        const books = [];
        
        detections.forEach((detection, index) => {
            if (this.isValidBookDetection(detection)) {
                books.push({
                    id: `mcp_book_${index}`,
                    x: detection.x,
                    y: detection.y,
                    width: detection.width,
                    height: detection.height,
                    confidence: detection.confidence,
                    title: `Book ${books.length + 1}`,
                    isReal: true,
                    spineArea: detection.width * detection.height,
                    estimatedThickness: detection.width * 0.6,
                    canRotate: detection.height < detection.width * 3,
                    canStack: detection.height > 100 && detection.width < 30,
                    volumeEfficiency: this.calculateVolumeEfficiency(detection.width, detection.height),
                    detectionMethod: 'MCP_YOLO_OpenCV',
                    rawDetection: detection
                });
            }
        });
        
        return books;
    }

    isValidBookDetection(detection) {
        const { width, height, confidence } = detection;
        
        const aspectRatio = height / width;
        const isBookSized = width > 10 && width < 100 && height > 60 && height < 400;
        const isBookRatio = aspectRatio > 1.2 && aspectRatio < 8;
        const isConfident = confidence > 0.3;
        
        return isBookSized && isBookRatio && isConfident;
    }

    calculateVolumeEfficiency(width, height) {
        const aspectRatio = height / width;
        const idealRatio = 2.5;
        const efficiency = 1 - Math.abs(aspectRatio - idealRatio) / idealRatio;
        return Math.max(0.1, Math.min(0.9, efficiency));
    }
}

export default MCPBookDetection;