/**
 * Book Detection Controller
 * Main controller that orchestrates MCP integration and fallback detection
 */

import MCPBookDetection from './mcp-integration.js';
import FallbackDetection from './fallback-detection.js';
import SpatialOptimizer from './spatial-optimizer.js';

class BookDetectionController {
    constructor() {
        this.mcpDetection = new MCPBookDetection();
        this.fallbackDetection = new FallbackDetection();
        this.spatialOptimizer = new SpatialOptimizer();
        
        this.detectionHistory = [];
        this.maxHistorySize = 5;
        this.stableBooks = [];
        this.arSuggestions = [];
    }

    async detectBooks(imageData) {
        console.log('🔍 Starting book detection pipeline...');
        
        try {
            // Try MCP detection first
            const books = await this.mcpDetection.detectBooks(imageData);
            console.log('✅ MCP detection successful:', books.length, 'books');
            return this.processDetectionResults(books, 'MCP');
            
        } catch (error) {
            console.warn('⚠️ MCP detection failed, using fallback:', error.message);
            
            // Fall back to enhanced local detection
            const books = this.fallbackDetection.detectBooks(imageData);
            console.log('✅ Fallback detection completed:', books.length, 'books');
            return this.processDetectionResults(books, 'Fallback');
        }
    }

    processDetectionResults(books, detectionType) {
        // Add to detection history for stability
        this.detectionHistory.push({
            timestamp: Date.now(),
            count: books.length,
            books: books,
            type: detectionType
        });

        // Keep history size manageable
        if (this.detectionHistory.length > this.maxHistorySize) {
            this.detectionHistory.shift();
        }

        // Stabilize book positions
        this.stableBooks = this.stabilizeBookPositions(books, this.stableBooks);

        // Generate spatial optimization suggestions
        this.arSuggestions = this.spatialOptimizer.generateOptimizationSuggestions(this.stableBooks);

        return {
            books: this.stableBooks,
            suggestions: this.arSuggestions,
            stats: this.calculateStats(),
            detectionType: detectionType
        };
    }

    stabilizeBookPositions(newBooks, oldBooks) {
        if (oldBooks.length === 0) {
            return newBooks.map(book => ({ ...book, stable: true }));
        }

        const stabilized = [];
        const usedOldBooks = new Set();
        const stabilityFactor = 0.6;

        // Match new books with old books based on proximity
        newBooks.forEach((newBook) => {
            let bestMatch = null;
            let bestDistance = Infinity;
            
            oldBooks.forEach((oldBook, idx) => {
                if (usedOldBooks.has(idx)) return;
                
                const distance = Math.sqrt(
                    Math.pow(newBook.x - oldBook.x, 2) + 
                    Math.pow(newBook.y - oldBook.y, 2)
                );
                
                if (distance < bestDistance && distance < 50) {
                    bestDistance = distance;
                    bestMatch = { book: oldBook, index: idx };
                }
            });
            
            if (bestMatch) {
                usedOldBooks.add(bestMatch.index);
                // Smooth transition from old to new position
                stabilized.push({
                    ...newBook,
                    x: bestMatch.book.x * stabilityFactor + newBook.x * (1 - stabilityFactor),
                    y: bestMatch.book.y * stabilityFactor + newBook.y * (1 - stabilityFactor),
                    width: bestMatch.book.width * stabilityFactor + newBook.width * (1 - stabilityFactor),
                    height: bestMatch.book.height * stabilityFactor + newBook.height * (1 - stabilityFactor),
                    confidence: Math.max(bestMatch.book.confidence * 0.8 + newBook.confidence * 0.2, 0.3),
                    stable: true
                });
            } else {
                // New book detected
                stabilized.push({
                    ...newBook,
                    stable: false
                });
            }
        });

        // Keep persistent books that weren't matched (brief disappearance tolerance)
        oldBooks.forEach((oldBook, idx) => {
            if (!usedOldBooks.has(idx) && oldBook.stable && oldBook.confidence > 0.2) {
                stabilized.push({
                    ...oldBook,
                    confidence: oldBook.confidence * 0.9,
                    stable: oldBook.confidence > 0.3
                });
            }
        });

        return stabilized.filter(book => book.confidence > 0.15);
    }

    calculateStats() {
        const totalBooks = this.stableBooks.length;
        const totalOptimizations = this.arSuggestions.length;
        
        // Calculate space utilization (assuming 2 shelves)
        const shelfWidth = 400; // Approximate shelf width
        const shelf1Books = this.stableBooks.filter(book => book.y < 200);
        const shelf2Books = this.stableBooks.filter(book => book.y >= 200);
        
        const shelf1Utilization = this.spatialOptimizer.calculateShelfUtilization(shelf1Books, shelfWidth, 200);
        const shelf2Utilization = this.spatialOptimizer.calculateShelfUtilization(shelf2Books, shelfWidth, 200);
        
        const avgUtilization = (shelf1Utilization.widthUtilization + shelf2Utilization.widthUtilization) / 2;
        const potentialGain = shelf1Utilization.potentialGain + shelf2Utilization.potentialGain;
        
        return {
            booksFound: totalBooks,
            spaceUsed: Math.round(avgUtilization),
            potentialGain: Math.round((potentialGain / (shelfWidth * 2)) * 100),
            optimizationSuggestions: totalOptimizations,
            detectionStability: this.calculateDetectionStability()
        };
    }

    calculateDetectionStability() {
        if (this.detectionHistory.length < 2) return 100;
        
        const recentCounts = this.detectionHistory.slice(-3).map(h => h.count);
        const avgCount = recentCounts.reduce((a, b) => a + b, 0) / recentCounts.length;
        const variance = recentCounts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / recentCounts.length;
        const stability = Math.max(0, 100 - (variance * 10));
        
        return Math.round(stability);
    }

    getDetectionMethod() {
        if (this.detectionHistory.length === 0) return 'None';
        return this.detectionHistory[this.detectionHistory.length - 1].type;
    }
}

export default BookDetectionController;