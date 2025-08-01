/**
 * Fallback Detection Module
 * Enhanced local detection when MCP servers are unavailable
 */

class FallbackDetection {
    constructor() {
        this.config = {
            edgeThreshold: 40,
            minBookWidth: 12,
            maxBookWidth: 90,
            minBookHeight: 60,
            maxBookHeight: 400,
            sampleStep: 4
        };
    }

    detectBooks(imageData) {
        console.log('🔄 Using enhanced fallback detection...');
        
        const books = [];
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Enhanced vertical edge detection
        const verticalLines = this.findVerticalColorChanges(data, width, height);
        console.log('📏 Fallback found vertical lines:', verticalLines.length);
        
        // If no lines found, try with lower threshold
        if (verticalLines.length === 0) {
            console.log('🔧 No lines found, trying with lower threshold...');
            this.config.edgeThreshold = 20;
            const fallbackLines = this.findVerticalColorChanges(data, width, height);
            console.log('📏 Fallback retry found lines:', fallbackLines.length);
            return this.processLinesIntoBooks(fallbackLines, height);
        }
        
        return this.processLinesIntoBooks(verticalLines, height);
    }

    processLinesIntoBooks(verticalLines, height) {
        const books = [];
        
        // Create books with improved validation
        for (let i = 0; i < verticalLines.length - 1; i++) {
            const leftX = verticalLines[i].x;
            const rightX = verticalLines[i + 1].x;
            const bookWidth = rightX - leftX;
            
            if (this.isValidBookWidth(bookWidth)) {
                const book = this.createBookFromLines(verticalLines[i], verticalLines[i + 1], height, books.length);
                if (book) {
                    books.push(book);
                }
            }
        }
        
        console.log('📚 Fallback detected books:', books.length);
        return books;
    }

    findVerticalColorChanges(data, width, height) {
        const lines = [];
        const step = this.config.sampleStep;
        
        // Enhanced color change detection
        for (let x = step; x < width - step; x += step) {
            let totalChange = 0;
            let avgY = 0;
            let samples = 0;
            let maxChange = 0;
            
            // Sample down the column with better coverage
            for (let y = height * 0.15; y < height * 0.85; y += step) {
                const colorChange = this.calculateColorChange(data, width, x, y, step);
                
                if (colorChange > 0) {
                    totalChange += colorChange;
                    avgY += y;
                    samples++;
                    maxChange = Math.max(maxChange, colorChange);
                }
            }
            
            if (samples > 0) {
                const avgChange = totalChange / samples;
                
                // Dynamic threshold based on image characteristics
                const threshold = this.calculateDynamicThreshold(maxChange, avgChange);
                
                if (avgChange > threshold) {
                    lines.push({
                        x: x,
                        y: avgY / samples,
                        strength: avgChange,
                        maxStrength: maxChange,
                        samples: samples
                    });
                }
            }
        }
        
        // Filter and sort lines
        return this.filterAndSortLines(lines);
    }

    calculateColorChange(data, width, x, y, step) {
        const idx = (y * width + x) * 4;
        const leftIdx = (y * width + (x - step)) * 4;
        const rightIdx = (y * width + (x + step)) * 4;
        
        if (leftIdx >= 0 && rightIdx < data.length) {
            // Calculate RGB difference
            const leftR = data[leftIdx];
            const leftG = data[leftIdx + 1];
            const leftB = data[leftIdx + 2];
            
            const rightR = data[rightIdx];
            const rightG = data[rightIdx + 1];
            const rightB = data[rightIdx + 2];
            
            // Enhanced color difference calculation
            const rDiff = Math.abs(leftR - rightR);
            const gDiff = Math.abs(leftG - rightG);
            const bDiff = Math.abs(leftB - rightB);
            
            // Weighted color difference (green channel more sensitive)
            return (rDiff * 0.3 + gDiff * 0.5 + bDiff * 0.2);
        }
        
        return 0;
    }

    calculateDynamicThreshold(maxChange, avgChange) {
        // Adaptive threshold based on image contrast
        const baseThreshold = this.config.edgeThreshold;
        const contrastFactor = maxChange / (avgChange + 1);
        
        if (contrastFactor > 3) {
            return baseThreshold * 0.8; // Lower threshold for high contrast
        } else if (contrastFactor < 1.5) {
            return baseThreshold * 1.2; // Higher threshold for low contrast
        }
        
        return baseThreshold;
    }

    filterAndSortLines(lines) {
        // Remove lines too close together (likely same book edge)
        const filtered = lines
            .sort((a, b) => a.x - b.x)
            .filter((line, i, arr) => {
                if (i === 0) return true;
                return line.x - arr[i - 1].x > 8; // Minimum separation
            });
        
        // Keep only strongest lines if too many detected
        if (filtered.length > 50) {
            return filtered
                .sort((a, b) => b.strength - a.strength)
                .slice(0, 50)
                .sort((a, b) => a.x - b.x);
        }
        
        return filtered;
    }

    isValidBookWidth(width) {
        return width >= this.config.minBookWidth && width <= this.config.maxBookWidth;
    }

    createBookFromLines(leftLine, rightLine, imageHeight, bookIndex) {
        const bookWidth = rightLine.x - leftLine.x;
        const avgY = (leftLine.y + rightLine.y) / 2;
        const shelfHeight = imageHeight / 2;
        const shelfIndex = avgY < imageHeight / 2 ? 0 : 1;
        
        // Enhanced confidence calculation
        const confidence = this.calculateBookConfidence(leftLine, rightLine, bookWidth);
        
        if (confidence < 0.2) {
            return null; // Skip low-confidence detections
        }
        
        const bookHeight = shelfHeight * 0.8;
        
        return {
            id: `fallback_book_${bookIndex}`,
            x: leftLine.x,
            y: shelfIndex * shelfHeight,
            width: bookWidth,
            height: bookHeight,
            confidence: confidence,
            title: `Book ${bookIndex + 1}`,
            isReal: true,
            spineArea: bookWidth * bookHeight,
            estimatedThickness: bookWidth * 0.6,
            canRotate: bookHeight < bookWidth * 3,
            canStack: bookHeight > 100 && bookWidth < 30,
            volumeEfficiency: this.calculateVolumeEfficiency(bookWidth, bookHeight),
            detectionMethod: 'Fallback_Enhanced',
            rawData: {
                leftLine: leftLine,
                rightLine: rightLine,
                shelfIndex: shelfIndex
            }
        };
    }

    calculateBookConfidence(leftLine, rightLine, bookWidth) {
        // Multi-factor confidence calculation
        const strengthFactor = Math.min(1, (leftLine.strength + rightLine.strength) / 200);
        const widthFactor = this.getWidthConfidenceFactor(bookWidth);
        const symmetryFactor = this.getSymmetryFactor(leftLine, rightLine);
        
        return Math.min(0.95, strengthFactor * 0.4 + widthFactor * 0.4 + symmetryFactor * 0.2);
    }

    getWidthConfidenceFactor(width) {
        // Confidence based on typical book widths
        if (width >= 20 && width <= 50) return 1.0;  // Optimal book width
        if (width >= 15 && width <= 70) return 0.8;  // Good book width
        if (width >= 12 && width <= 90) return 0.6;  // Acceptable book width
        return 0.3; // Unlikely book width
    }

    getSymmetryFactor(leftLine, rightLine) {
        // Check if left and right edges have similar strength (symmetry)
        const strengthDiff = Math.abs(leftLine.strength - rightLine.strength);
        const avgStrength = (leftLine.strength + rightLine.strength) / 2;
        const symmetry = 1 - (strengthDiff / avgStrength);
        return Math.max(0.1, symmetry);
    }

    calculateVolumeEfficiency(width, height) {
        const aspectRatio = height / width;
        const idealRatio = 2.5;
        const efficiency = 1 - Math.abs(aspectRatio - idealRatio) / idealRatio;
        return Math.max(0.1, Math.min(0.9, efficiency));
    }

    createTestBook(index, imageHeight) {
        const shelfHeight = imageHeight / 2;
        const bookWidth = 30 + index * 5;
        const x = 50 + index * 100;
        
        return {
            id: `test_book_${index}`,
            x: x,
            y: index * shelfHeight,
            width: bookWidth,
            height: shelfHeight * 0.8,
            confidence: 0.7,
            title: `Test Book ${index + 1}`,
            isReal: false, // Mark as test data
            spineArea: bookWidth * shelfHeight * 0.8,
            estimatedThickness: bookWidth * 0.6,
            canRotate: true,
            canStack: false,
            volumeEfficiency: 0.6,
            detectionMethod: 'Debug_Test',
            rawData: { test: true }
        };
    }
}

export default FallbackDetection;