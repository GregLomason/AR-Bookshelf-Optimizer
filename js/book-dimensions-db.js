/**
 * Book Dimensions Database
 * Standard US book and bookshelf dimensions for validation
 */

class BookDimensionsDB {
    constructor() {
        // All dimensions in pixels (assuming ~96 DPI for camera images)
        this.bookTypes = {
            massMarketPaperback: {
                width: { min: 100, ideal: 108, max: 116 },      // 4.25"
                height: { min: 160, ideal: 175, max: 190 },     // 6.87"
                spine: { min: 6, ideal: 12, max: 36 },          // 0.25"-1.5"
                aspectRatio: { min: 1.4, ideal: 1.6, max: 2.0 },
                confidence: 0.9
            },
            tradePaperback: {
                width: { min: 132, ideal: 140, max: 148 },      // 5.5"
                height: { min: 204, ideal: 216, max: 228 },     // 8.5"
                spine: { min: 6, ideal: 15, max: 36 },          // 0.25"-1.5"
                aspectRatio: { min: 1.4, ideal: 1.55, max: 1.8 },
                confidence: 0.95
            },
            hardcover: {
                width: { min: 144, ideal: 153, max: 162 },      // 6"
                height: { min: 216, ideal: 229, max: 242 },     // 9"
                spine: { min: 18, ideal: 24, max: 60 },         // 0.75"-2.5"
                aspectRatio: { min: 1.3, ideal: 1.5, max: 1.8 },
                confidence: 1.0
            },
            largeFormat: {
                width: { min: 168, ideal: 178, max: 188 },      // 7"
                height: { min: 240, ideal: 254, max: 268 },     // 10"
                spine: { min: 18, ideal: 30, max: 60 },         // 0.75"-2.5"
                aspectRatio: { min: 1.3, ideal: 1.43, max: 1.6 },
                confidence: 0.8
            },
            textbook: {
                width: { min: 204, ideal: 216, max: 228 },      // 8.5"
                height: { min: 264, ideal: 280, max: 296 },     // 11"
                spine: { min: 24, ideal: 48, max: 72 },         // 1"-3"
                aspectRatio: { min: 1.2, ideal: 1.3, max: 1.5 },
                confidence: 0.7
            }
        };

        this.shelfStandards = {
            height: { min: 203, ideal: 242, max: 280 },         // 8"-11"
            depth: { min: 203, ideal: 254, max: 305 },          // 8"-12"
            width: { min: 610, ideal: 914, max: 1219 },         // 24"-48"
            bookCapacity: { min: 8, ideal: 18, max: 25 }        // Per shelf
        };

        // Pixel to inch conversion (approximate)
        this.pixelsPerInch = 25.4; // Rough estimate for camera images
    }

    /**
     * Validate if detected dimensions match known book types
     */
    validateBookDimensions(width, height, spineWidth = null) {
        let bestMatch = null;
        let bestScore = 0;

        const aspectRatio = height / width;

        for (const [typeName, type] of Object.entries(this.bookTypes)) {
            let score = 0;
            let factors = 0;

            // Width validation
            if (width >= type.width.min && width <= type.width.max) {
                const widthScore = 1 - Math.abs(width - type.width.ideal) / (type.width.max - type.width.min);
                score += widthScore * 0.3;
                factors += 0.3;
            }

            // Height validation
            if (height >= type.height.min && height <= type.height.max) {
                const heightScore = 1 - Math.abs(height - type.height.ideal) / (type.height.max - type.height.min);
                score += heightScore * 0.3;
                factors += 0.3;
            }

            // Aspect ratio validation
            if (aspectRatio >= type.aspectRatio.min && aspectRatio <= type.aspectRatio.max) {
                const ratioScore = 1 - Math.abs(aspectRatio - type.aspectRatio.ideal) / 
                                 (type.aspectRatio.max - type.aspectRatio.min);
                score += ratioScore * 0.2;
                factors += 0.2;
            }

            // Spine width validation (if provided)
            if (spineWidth && spineWidth >= type.spine.min && spineWidth <= type.spine.max) {
                const spineScore = 1 - Math.abs(spineWidth - type.spine.ideal) / 
                                  (type.spine.max - type.spine.min);
                score += spineScore * 0.2;
                factors += 0.2;
            }

            // Normalize score
            if (factors > 0) {
                score = (score / factors) * type.confidence;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        type: typeName,
                        confidence: score,
                        dimensions: type,
                        matches: {
                            width: width >= type.width.min && width <= type.width.max,
                            height: height >= type.height.min && height <= type.height.max,
                            aspectRatio: aspectRatio >= type.aspectRatio.min && aspectRatio <= type.aspectRatio.max,
                            spine: spineWidth ? (spineWidth >= type.spine.min && spineWidth <= type.spine.max) : null
                        }
                    };
                }
            }
        }

        return bestMatch;
    }

    /**
     * Get confidence multiplier based on how well dimensions match book standards
     */
    getDimensionConfidence(width, height, spineWidth = null) {
        const validation = this.validateBookDimensions(width, height, spineWidth);
        
        if (!validation) {
            // No match found - very low confidence
            return 0.1;
        }

        // Scale confidence: 0.3 (poor match) to 1.0 (perfect match)
        return Math.max(0.3, validation.confidence);
    }

    /**
     * Validate shelf dimensions
     */
    validateShelfDimensions(width, height) {
        const standards = this.shelfStandards;
        
        const widthValid = width >= standards.width.min && width <= standards.width.max;
        const heightValid = height >= standards.height.min && height <= standards.height.max;
        
        let confidence = 0;
        if (heightValid) confidence += 0.6;
        if (widthValid) confidence += 0.4;
        
        return {
            isValid: widthValid || heightValid, // At least one dimension should match
            confidence: confidence,
            estimatedCapacity: Math.floor(width / 25), // Rough books per shelf estimate
            matches: { width: widthValid, height: heightValid }
        };
    }

    /**
     * Get realistic spine width range for validation
     */
    getSpineWidthRange() {
        let minSpine = Infinity;
        let maxSpine = 0;
        
        for (const type of Object.values(this.bookTypes)) {
            minSpine = Math.min(minSpine, type.spine.min);
            maxSpine = Math.max(maxSpine, type.spine.max);
        }
        
        return { min: minSpine, max: maxSpine };
    }

    /**
     * Get realistic book height range
     */
    getBookHeightRange() {
        let minHeight = Infinity;
        let maxHeight = 0;
        
        for (const type of Object.values(this.bookTypes)) {
            minHeight = Math.min(minHeight, type.height.min);
            maxHeight = Math.max(maxHeight, type.height.max);
        }
        
        return { min: minHeight, max: maxHeight };
    }

    /**
     * Estimate book thickness from spine width and type
     */
    estimateThickness(spineWidth, bookType = null) {
        if (bookType && this.bookTypes[bookType]) {
            return spineWidth * 0.8; // 80% of spine width is typical
        }
        
        // General estimation
        if (spineWidth < 15) return spineWidth * 0.9; // Thin books
        if (spineWidth < 30) return spineWidth * 0.8; // Medium books
        return spineWidth * 0.7; // Thick books
    }

    /**
     * Get debugging info for dimension validation
     */
    getDimensionDebugInfo(width, height, spineWidth = null) {
        const validation = this.validateBookDimensions(width, height, spineWidth);
        const spineRange = this.getSpineWidthRange();
        const heightRange = this.getBookHeightRange();
        
        return {
            input: { width, height, spineWidth },
            validation: validation,
            ranges: {
                spineWidth: spineRange,
                bookHeight: heightRange
            },
            recommendation: validation ? 
                `Matches ${validation.type} (${Math.round(validation.confidence * 100)}% confidence)` :
                'No book type match found'
        };
    }
}

export default BookDimensionsDB;