/**
 * Spatial Optimization Module
 * Physics-based calculations for book arrangement optimization
 */

import BookDimensionsDB from './book-dimensions-db.js';

class SpatialOptimizer {
    constructor() {
        this.dimensionsDB = new BookDimensionsDB();
        
        this.SHELF_CONSTRAINTS = {
            maxHeight: 300,
            maxDepth: 250,
            minClearance: 20
        };
    }

    generateOptimizationSuggestions(books, shelfDimensions) {
        const suggestions = [];
        
        books.forEach(book => {
            const analysis = this.analyzeBookOptimization(book, shelfDimensions);
            
            if (analysis.canOptimize) {
                suggestions.push({
                    bookId: book.id,
                    book: book,
                    type: analysis.optimizationType,
                    text: analysis.suggestionText,
                    efficiency: analysis.efficiencyGain,
                    volumeGain: analysis.volumeGain,
                    x: book.x + book.width + 10,
                    y: book.y + book.height / 2,
                    stable: true,
                    physics: analysis.physicsData
                });
            }
        });
        
        return suggestions;
    }

    analyzeBookOptimization(book, shelfDimensions = null) {
        const analysis = {
            canOptimize: false,
            optimizationType: 'none',
            suggestionText: '',
            efficiencyGain: 0,
            volumeGain: 0,
            physicsData: {}
        };

        // Calculate current volume usage
        const currentVolume = book.width * book.height * book.estimatedThickness;
        
        // Check rotation optimization
        const rotationAnalysis = this.analyzeRotation(book);
        if (rotationAnalysis.beneficial) {
            analysis.canOptimize = true;
            analysis.optimizationType = 'rotate';
            analysis.suggestionText = '↻ Rotate horizontally';
            analysis.efficiencyGain = rotationAnalysis.spaceGain;
            analysis.volumeGain = rotationAnalysis.volumeGain;
            analysis.physicsData = rotationAnalysis;
            return analysis;
        }

        // Check stacking optimization
        const stackingAnalysis = this.analyzeStacking(book);
        if (stackingAnalysis.beneficial) {
            analysis.canOptimize = true;
            analysis.optimizationType = 'stack';
            analysis.suggestionText = '⚏ Stack horizontally';
            analysis.efficiencyGain = stackingAnalysis.spaceGain;
            analysis.volumeGain = stackingAnalysis.volumeGain;
            analysis.physicsData = stackingAnalysis;
            return analysis;
        }

        // Check face-out optimization
        const faceOutAnalysis = this.analyzeFaceOut(book);
        if (faceOutAnalysis.beneficial) {
            analysis.canOptimize = true;
            analysis.optimizationType = 'faceout';
            analysis.suggestionText = '↔ Face out';
            analysis.efficiencyGain = faceOutAnalysis.visibilityGain;
            analysis.volumeGain = faceOutAnalysis.volumeGain;
            analysis.physicsData = faceOutAnalysis;
            return analysis;
        }

        return analysis;
    }

    analyzeRotation(book) {
        const analysis = {
            beneficial: false,
            spaceGain: 0,
            volumeGain: 0,
            newDimensions: null
        };

        // Only rotate if book is short and wide enough
        if (book.height < book.width * 2.5 && book.width > 30) {
            // Calculate space saved by rotating
            const currentFootprint = book.width * book.estimatedThickness;
            const rotatedFootprint = book.height * book.estimatedThickness;
            const spaceSaved = currentFootprint - rotatedFootprint;
            
            if (spaceSaved > 5) { // Minimum 5px space gain
                analysis.beneficial = true;
                analysis.spaceGain = Math.round((spaceSaved / currentFootprint) * 100);
                analysis.volumeGain = spaceSaved;
                analysis.newDimensions = {
                    width: book.height,
                    height: book.width,
                    thickness: book.estimatedThickness
                };
            }
        }

        return analysis;
    }

    analyzeStacking(book) {
        const analysis = {
            beneficial: false,
            spaceGain: 0,
            volumeGain: 0,
            stackConfiguration: null
        };

        // Stack tall, thin books horizontally
        if (book.height > 120 && book.width < 35 && book.estimatedThickness < 25) {
            // Calculate stacking efficiency
            const currentFootprint = book.width * book.estimatedThickness;
            const stackedFootprint = book.height * book.estimatedThickness;
            const spaceSaved = Math.max(0, currentFootprint - (stackedFootprint * 0.6)); // 60% efficiency when stacked
            
            if (spaceSaved > 3) {
                analysis.beneficial = true;
                analysis.spaceGain = Math.round((spaceSaved / currentFootprint) * 100);
                analysis.volumeGain = spaceSaved;
                analysis.stackConfiguration = {
                    orientation: 'horizontal',
                    estimatedBooks: Math.floor(book.height / 25), // ~25px per stacked book
                    totalVolume: stackedFootprint
                };
            }
        }

        return analysis;
    }

    analyzeFaceOut(book) {
        const analysis = {
            beneficial: false,
            visibilityGain: 0,
            volumeGain: 0,
            displayAdvantage: null
        };

        // Face out wide books for better visibility/access
        if (book.width > 45 && book.height > 80) {
            const visibilityImprovement = book.width * 0.8; // Visibility proportional to width
            const volumeImpact = book.estimatedThickness - book.width; // May use more depth
            
            if (visibilityImprovement > 25) { // Significant visibility gain
                analysis.beneficial = true;
                analysis.visibilityGain = Math.round(visibilityImprovement);
                analysis.volumeGain = volumeImpact; // May be negative (uses more space)
                analysis.displayAdvantage = {
                    frontFacing: true,
                    coverVisible: true,
                    easyAccess: true
                };
            }
        }

        return analysis;
    }

    calculateShelfUtilization(books, shelfWidth, shelfHeight) {
        const totalBookWidth = books.reduce((sum, book) => sum + book.width, 0);
        const totalBookVolume = books.reduce((sum, book) => 
            sum + (book.width * book.height * book.estimatedThickness), 0);
        
        const shelfArea = shelfWidth * shelfHeight;
        const maxShelfVolume = shelfWidth * shelfHeight * this.SHELF_CONSTRAINTS.maxDepth;
        
        return {
            widthUtilization: (totalBookWidth / shelfWidth) * 100,
            volumeUtilization: (totalBookVolume / maxShelfVolume) * 100,
            spaceRemaining: shelfWidth - totalBookWidth,
            potentialGain: this.calculatePotentialGain(books)
        };
    }

    calculatePotentialGain(books) {
        let totalGain = 0;
        
        books.forEach(book => {
            const rotationGain = this.analyzeRotation(book).volumeGain || 0;
            const stackingGain = this.analyzeStacking(book).volumeGain || 0;
            totalGain += Math.max(rotationGain, stackingGain);
        });
        
        return totalGain;
    }
}

export default SpatialOptimizer;