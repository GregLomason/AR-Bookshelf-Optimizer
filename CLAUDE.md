# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AR-Bookshelf-Optimizer is a web-based augmented reality application that provides live AR overlays to detect and suggest spatial organization and space optimization of bookshelves. The app identifies which books need to be turned face-wise, stacked, rotated, etc. to optimize volume per shelf.

## Architecture

This is a single-page web application built with vanilla HTML, CSS, and JavaScript:

- **index.html**: Complete self-contained web application
- **Frontend**: Pure HTML/CSS/JavaScript with no external dependencies
- **AR Features**: 
  - Real-time camera feed processing
  - Computer vision-based book spine detection using canvas ImageData
  - AR overlay rendering with optimization suggestions
  - Touch interaction for suggestion feedback

## Key Technical Components

### Computer Vision Pipeline
- **Edge Detection**: Sobel operator for vertical edge detection (book spines)
- **Region Detection**: Flood-fill algorithm to identify book spine regions
- **Stabilization**: Position smoothing to reduce jitter in real-time detection
- **Shelf Detection**: Horizontal line detection to identify shelf boundaries

### AR Rendering System
- Uses HTML5 Canvas for overlay rendering on top of live video feed
- Implements detection boxes, confidence badges, and interactive AR suggestions
- Supports multiple suggestion types: rotate, stack, rearrange, group

### Mobile-First Design
- Optimized for iPhone camera access
- Responsive touch interactions
- Permission handling for camera access
- Orientation change support

## Development

### Running the Application
```bash
# Serve locally (requires HTTPS for camera access)
python -m http.server 8000 --bind 127.0.0.1
# or
npx http-server -p 8000
```

### Camera Requirements
- Must be served over HTTPS (except localhost)
- Requires camera permissions
- Optimized for mobile devices with rear-facing camera

### Key Functions to Understand
- `performRealBookDetection()`: Core computer vision algorithm
- `detectVerticalEdges()`: Sobel edge detection implementation
- `generateRealOptimizationSuggestions()`: AR suggestion logic
- `stabilizeBookPositions()`: Position smoothing algorithm

## Code Structure

The application follows a modular JavaScript architecture within the single HTML file:

- **Initialization**: Camera setup and canvas configuration
- **Detection Pipeline**: Real-time image processing and book detection
- **AR Rendering**: Overlay drawing and user interaction
- **UI Management**: Control buttons and status updates

## Testing

Test the application by:
1. Opening in a modern mobile browser (preferably iPhone Safari)
2. Granting camera permissions
3. Pointing camera at a bookshelf
4. Verifying AR suggestions appear and respond to touch

## Performance Considerations

- Processing throttled to 500ms intervals to reduce CPU load
- Position stabilization prevents jittery AR overlays
- Canvas operations optimized for mobile performance
- Frame-based processing with requestAnimationFrame