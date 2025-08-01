/**
 * Fallback Detection Module
 * Enhanced local detection when MCP servers are unavailable
 */

class FallbackDetection {
    constructor() {
        this.config = {
            edgeThreshold: 60,      // Much higher threshold to reduce false positives
            minBookWidth: 15,       // Larger minimum width
            maxBookWidth: 45,       // Smaller maximum width
            minBookHeight: 100,     // Taller minimum height
            maxBookHeight: 300,
            sampleStep: 3,          // Larger step to reduce noise
            shelfDetectionEnabled: true,
            verticalEdgeWeight: 0.8,
            colorDifferenceWeight: 0.2,
            minEdgeSeparation: 12,  // Minimum distance between detected edges
            confidenceThreshold: 0.4 // Higher confidence requirement
        };
    }

    detectBooks(imageData) {
        console.log('🔄 Using enhanced fallback detection...');
        
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Step 1: Detect shelf regions
        const shelves = this.detectShelves(data, width, height);
        console.log('📚 Detected shelves:', shelves.length);
        
        let allBooks = [];
        
        // Step 2: Process each shelf separately for better accuracy
        for (let shelfIndex = 0; shelfIndex < shelves.length; shelfIndex++) {
            const shelf = shelves[shelfIndex];
            const shelfBooks = this.detectBooksInShelf(data, width, height, shelf, shelfIndex);
            console.log(`📖 Shelf ${shelfIndex + 1} detected books:`, shelfBooks.length);
            allBooks = allBooks.concat(shelfBooks);
        }
        
        console.log('📚 Total fallback detected books:', allBooks.length);
        return allBooks;
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

    detectShelves(data, width, height) {
        // Detect horizontal shelf lines
        const shelves = [];
        const step = 4;
        
        for (let y = height * 0.1; y < height * 0.9; y += step) {
            let horizontalEdgeStrength = 0;
            let samples = 0;
            
            for (let x = width * 0.1; x < width * 0.9; x += step * 2) {
                const idx = (y * width + x) * 4;
                const aboveIdx = ((y - step) * width + x) * 4;
                const belowIdx = ((y + step) * width + x) * 4;
                
                if (aboveIdx >= 0 && belowIdx < data.length) {
                    const aboveGray = (data[aboveIdx] + data[aboveIdx + 1] + data[aboveIdx + 2]) / 3;
                    const belowGray = (data[belowIdx] + data[belowIdx + 1] + data[belowIdx + 2]) / 3;
                    const edgeStrength = Math.abs(aboveGray - belowGray);
                    
                    horizontalEdgeStrength += edgeStrength;
                    samples++;
                }
            }
            
            if (samples > 0) {
                const avgStrength = horizontalEdgeStrength / samples;
                if (avgStrength > 15) {
                    shelves.push({
                        y: y,
                        strength: avgStrength,
                        topY: Math.max(0, y - 100),
                        bottomY: Math.min(height, y + 100)
                    });
                }
            }
        }
        
        // If no clear shelves detected, create default regions
        if (shelves.length === 0) {
            return [
                { y: height * 0.25, topY: 0, bottomY: height * 0.5, strength: 10 },
                { y: height * 0.75, topY: height * 0.5, bottomY: height, strength: 10 }
            ];
        }
        
        // Sort by y position and merge close shelves
        return this.mergeShelves(shelves.sort((a, b) => a.y - b.y));
    }
    
    mergeShelves(shelves) {
        const merged = [];
        let current = shelves[0];
        
        for (let i = 1; i < shelves.length; i++) {
            if (shelves[i].y - current.y < 80) {
                // Merge close shelves
                current.strength = Math.max(current.strength, shelves[i].strength);
                current.bottomY = shelves[i].bottomY;
            } else {
                merged.push(current);
                current = shelves[i];
            }
        }
        merged.push(current);
        
        return merged;
    }
    
    detectBooksInShelf(data, width, height, shelf, shelfIndex) {
        const books = [];
        const step = this.config.sampleStep;
        const shelfTop = shelf.topY;
        const shelfBottom = shelf.bottomY;
        const shelfHeight = shelfBottom - shelfTop;
        
        // Find vertical edges within this shelf region
        const verticalEdges = [];
        
        for (let x = step; x < width - step; x += step) {
            let totalEdgeStrength = 0;
            let samples = 0;
            
            // Sample within shelf bounds
            for (let y = shelfTop + shelfHeight * 0.1; y < shelfBottom - shelfHeight * 0.1; y += step) {
                const edgeStrength = this.calculateVerticalEdgeStrength(data, width, x, y, step);
                if (edgeStrength > 0) {
                    totalEdgeStrength += edgeStrength;
                    samples++;
                }
            }
            
            if (samples > 0) {
                const avgStrength = totalEdgeStrength / samples;
                // Much stricter threshold to prevent over-detection
                if (avgStrength > this.config.edgeThreshold && samples > 3) {
                    verticalEdges.push({
                        x: x,
                        strength: avgStrength,
                        shelfIndex: shelfIndex,
                        samples: samples
                    });
                }
            }
        }
        
        // Filter edges and create books
        const filteredEdges = this.filterVerticalEdges(verticalEdges);
        console.log(`📏 Shelf ${shelfIndex + 1} found ${filteredEdges.length} vertical edges`);
        
        // Create books from pairs of edges with extensive validation
        for (let i = 0; i < filteredEdges.length - 1; i++) {
            const leftEdge = filteredEdges[i];
            const rightEdge = filteredEdges[i + 1];
            const bookWidth = rightEdge.x - leftEdge.x;
            
            if (this.isValidBookWidth(bookWidth)) {
                const confidence = this.calculateBookConfidenceFromEdges(leftEdge, rightEdge, bookWidth);
                
                // Multiple validation layers to prevent false positives
                if (confidence > this.config.confidenceThreshold &&
                    this.validateBookRegion(leftEdge.x, shelfTop, bookWidth, shelfHeight, leftEdge, rightEdge)) {
                    
                    const book = {
                        id: `fallback_s${shelfIndex}_b${books.length}`,
                        x: leftEdge.x,
                        y: shelfTop,
                        width: bookWidth,
                        height: shelfHeight * 0.85,
                        confidence: confidence,
                        title: `Book ${books.length + 1}`,
                        isReal: true,
                        spineArea: bookWidth * shelfHeight * 0.85,
                        estimatedThickness: bookWidth * 0.6,
                        canRotate: shelfHeight < bookWidth * 3,
                        canStack: shelfHeight > 100 && bookWidth < 30,
                        volumeEfficiency: this.calculateVolumeEfficiency(bookWidth, shelfHeight * 0.85),
                        detectionMethod: 'Fallback_Enhanced_v3',
                        shelfIndex: shelfIndex,
                        rawData: { leftEdge, rightEdge }
                    };
                    
                    books.push(book);
                }
            }
        }
        
        // Final validation: limit books per shelf to realistic numbers
        const maxBooksPerShelf = 20; // Maximum realistic books per shelf
        if (books.length > maxBooksPerShelf) {
            // Keep only the highest confidence books
            return books
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, maxBooksPerShelf)
                .sort((a, b) => a.x - b.x); // Re-sort by position
        }
        
        return books;
    }
    
    calculateVerticalEdgeStrength(data, width, x, y, step) {
        const idx = (y * width + x) * 4;
        const leftIdx = (y * width + (x - step)) * 4;
        const rightIdx = (y * width + (x + step)) * 4;
        
        if (leftIdx >= 0 && rightIdx < data.length) {
            // Calculate both color difference and luminance gradient
            const leftLum = this.getLuminance(data, leftIdx);
            const rightLum = this.getLuminance(data, rightIdx);
            const currentLum = this.getLuminance(data, idx);
            
            // Sobel-like vertical edge detection
            const gradient = Math.abs(rightLum - leftLum);
            
            // Color change detection
            const colorDiff = this.getColorDifference(data, leftIdx, rightIdx);
            
            return gradient * this.config.verticalEdgeWeight + colorDiff * this.config.colorDifferenceWeight;
        }
        
        return 0;
    }
    
    getLuminance(data, idx) {
        return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    
    getColorDifference(data, idx1, idx2) {
        const r1 = data[idx1], g1 = data[idx1 + 1], b1 = data[idx1 + 2];
        const r2 = data[idx2], g2 = data[idx2 + 1], b2 = data[idx2 + 2];
        
        return Math.sqrt(
            Math.pow(r2 - r1, 2) + 
            Math.pow(g2 - g1, 2) + 
            Math.pow(b2 - b1, 2)
        );
    }
    
    filterVerticalEdges(edges) {
        // Sort by strength first, then by x position
        const sortedByStrength = edges.sort((a, b) => b.strength - a.strength);
        
        // Take only the strongest edges to prevent over-detection
        const maxEdgesPerShelf = 40; // Limit to reasonable number
        const strongestEdges = sortedByStrength.slice(0, maxEdgesPerShelf);
        
        // Sort by x position for processing
        const sorted = strongestEdges.sort((a, b) => a.x - b.x);
        
        // Remove edges too close together with stricter separation
        const filtered = [];
        let lastX = -100;
        
        for (const edge of sorted) {
            if (edge.x - lastX > this.config.minEdgeSeparation) {
                // Additional validation: require minimum strength
                if (edge.strength > this.config.edgeThreshold * 1.2) {
                    filtered.push(edge);
                    lastX = edge.x;
                }
            } else {
                // Keep the stronger edge only if significantly stronger
                if (filtered.length > 0 && edge.strength > filtered[filtered.length - 1].strength * 1.3) {
                    filtered[filtered.length - 1] = edge;
                    lastX = edge.x;
                }
            }
        }
        
        console.log(`🔍 Filtered edges: ${edges.length} → ${filtered.length}`);
        return filtered;
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

    validateBookRegion(x, y, width, height, leftEdge, rightEdge) {
        // Additional validation to prevent false book detections
        
        // 1. Check edge strength consistency
        const strengthRatio = Math.min(leftEdge.strength, rightEdge.strength) / Math.max(leftEdge.strength, rightEdge.strength);
        if (strengthRatio < 0.3) return false; // Edges too dissimilar
        
        // 2. Check if width is in realistic book range
        if (width < 15 || width > 40) return false;
        
        // 3. Check sample consistency (both edges should have good coverage)
        if (leftEdge.samples < 3 || rightEdge.samples < 3) return false;
        
        // 4. Minimum strength requirement
        if (leftEdge.strength < this.config.edgeThreshold * 0.8 || 
            rightEdge.strength < this.config.edgeThreshold * 0.8) return false;
        
        return true;
    }
    
    calculateBookConfidenceFromEdges(leftEdge, rightEdge, bookWidth) {
        const strengthFactor = Math.min(1, (leftEdge.strength + rightEdge.strength) / 250);
        const widthFactor = this.getWidthConfidenceFactor(bookWidth);
        const symmetryFactor = Math.max(0.1, 1 - Math.abs(leftEdge.strength - rightEdge.strength) / Math.max(leftEdge.strength, rightEdge.strength));
        const sampleFactor = Math.min(1, (leftEdge.samples + rightEdge.samples) / 12);
        
        // Even stricter confidence calculation
        const confidence = strengthFactor * 0.35 + widthFactor * 0.45 + symmetryFactor * 0.1 + sampleFactor * 0.1;
        return Math.min(0.8, confidence);
    }

    getWidthConfidenceFactor(width) {
        // Much stricter confidence based on realistic book spine widths
        if (width >= 18 && width <= 32) return 1.0;  // Optimal book spine width
        if (width >= 15 && width <= 40) return 0.7;  // Good book spine width
        if (width >= 12 && width <= 45) return 0.4;  // Marginal book spine width
        return 0.1; // Very unlikely book spine width
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