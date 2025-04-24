# Atlas Map Tester

A testing environment for Figma-exported sprite atlas implementations in Phaser 3. This project provides a visual playground to test atlas sprite placement, scaling, and interactions in a tile-based game environment.

## Features

### Atlas Integration
- Supports Figma-exported sprite atlas files
- Handles multiple sprite frames within a single atlas
- Maintains sprite proportions and quality

### Map Features
- Tile-based grid system
- Grid-snapped object placement
- Support for various object sizes
- Configurable collision detection
- Partial off-screen object placement for large items

### Interactive Elements
- Player character with movement controls
- Zoom controls (mouse wheel and touch pinch)
- Toggle-able UI elements:
  - Grid visibility
  - Tile highlighting
  - Collision boxes
  - UI overlay visibility

### Debug Information
- Real-time tile coordinates
- Active tile information
- Collision box dimensions
- Object placement details

### Rendering Options
- Anti-aliasing toggle
- Pixel-perfect rendering toggle
- Adjustable zoom levels

## Usage

1. Place your atlas files (`CQ_SpriteAtlas.png` and `CQ_phaser-atlas.json`) in the project root
2. Configure object properties in `game.js`:
   ```javascript
   const objectTypes = [
       { key: 'House', frame: 'House', scale: 1, count: 2, allowPartialOffscreen: true, ... },
       { key: 'Bush', frame: 'Bush', scale: 1, count: 25, allowPartialOffscreen: false, ... },
       // Add more object types as needed
   ];
   ```
3. Adjust tile size and world dimensions in `game.js`:
   ```javascript
   const TILE_SIZE = 64;
   const WORLD_WIDTH = 3200;
   const WORLD_HEIGHT = 3200;
   ```

## Controls
- Arrow keys: Move character
- Mouse wheel / Pinch: Zoom in/out
- Click UI buttons to toggle various features
- Eye icon: Toggle UI visibility

## Technical Details
- Built with Phaser 3.60.0
- Uses HTML5 Canvas for rendering
- Supports touch and mouse input
- Implements physics-based collision detection
- Grid-based positioning system

## Purpose
This testing environment is designed to validate and visualize sprite atlas exports from Figma, ensuring proper implementation in Phaser-based games. It helps developers verify:
- Correct sprite extraction from atlas
- Proper scaling and positioning
- Collision detection accuracy
- Performance with multiple sprites
- UI/UX functionality

Perfect for testing atlas exports before implementing them in production game environments.
