const WORLD_WIDTH = 3840;
const WORLD_HEIGHT = 3840;

const config = {
    type: Phaser.AUTO,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    parent: 'game',
    backgroundColor: '#5C9D2A',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game',
        width: '100%',
        height: '100%',
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: true,
            debugShowBody: true,
            debugShowVelocity: true,
            debugBodyColor: 0xff00ff
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let cursors;
let currentTile = { x: 0, y: 0 };
const TILE_SIZE = 64;

// Spawn location configuration
const SPAWN_LOCATION = {
    tileX: 31,      // Current Tile X
    tileY: 44,      // Current Tile Y
    tileIndex: 2671 // Tile Index
};

// Forge location configuration
const FORGE_LOCATION = {
    tileX: 15,      // Fixed Forge position
    tileY: 20,      // Roughly centered but offset from player

};

// Track tiles and objects
let worldObjects = new Map(); // Key: 'x,y', Value: {object: PhaserObject, type: string}
let tileSprites = new Map(); // Key: 'x,y', Value: Phaser.GameObjects.Sprite
let highlightedTiles = new Set(); // Track currently highlighted tiles

// UI state
let showGrid = true;
let showHighlight = true;
let showCollider = true;
let currentZoom = 1.0;
let targetX = null;
let targetY = null;
const BASE_SPEED = 300; // Base movement speed

// Asset dimensions
const CRITTER_WIDTH = 256;
const CRITTER_HEIGHT = 328;

// Store scene reference for physics debug toggle
let currentScene;

// Update asset size display
function updateAssetSizes(zoom) {
    const currentWidth = Math.round(CRITTER_WIDTH * zoom);
    const currentHeight = Math.round(CRITTER_HEIGHT * zoom);
    document.getElementById('original-size').textContent = `${CRITTER_WIDTH}x${CRITTER_HEIGHT}`;
    document.getElementById('current-size').textContent = `${currentWidth}x${currentHeight}`;
}

// Zoom control functions
function updateZoom(value) {
    // Clamp zoom value between -0.3 and 1
    value = Math.max(-0.3, Math.min(1, value));
    currentZoom = value;
    if (currentScene) {
        currentScene.cameras.main.setZoom(value);
        document.getElementById('zoom-level').textContent = value.toFixed(1) + 'x';
        document.getElementById('zoom-slider').value = value;
        updateAssetSizes(value);
    }
}

function handleMouseWheel(event) {
    if (currentScene) {
        // Delta is typically 100 or -100, so we scale it down
        const zoomChange = event.deltaY * -0.0005; // Smaller increment for smoother zoom
        updateZoom(currentZoom + zoomChange);
    }
}

// Track touch points for pinch zoom
let initialPinchDistance = null;

function getDistance(touch1, touch2) {
    return Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
    );
}

function handleTouchStart(event) {
    if (event.touches.length === 2) {
        initialPinchDistance = getDistance(event.touches[0], event.touches[1]);
    }
}

function handleTouchMove(event) {
    if (event.touches.length === 2 && initialPinchDistance !== null) {
        const currentDistance = getDistance(event.touches[0], event.touches[1]);
        const scale = currentDistance / initialPinchDistance;
        const zoomChange = (scale > 1 ? 0.005 : -0.005); // Smaller increment for smoother zoom
        updateZoom(currentZoom + zoomChange);
    }
}

function handleTouchEnd() {
    initialPinchDistance = null;
}

function handlePinchZoom(event) {
    if (currentScene && event.scale !== 1) {
        const zoomChange = (event.scale > 1 ? 0.01 : -0.01); // Smaller increment for smoother zoom
        updateZoom(currentZoom + zoomChange);
    }
}

// Toggle functions
function toggleGrid() {
    showGrid = !showGrid;
    const btn = document.getElementById('toggle-grid');
    btn.textContent = `Grid: ${showGrid ? 'ON' : 'OFF'}`;
    btn.classList.toggle('active', showGrid);
    
    // Update all tiles visibility
    tileSprites.forEach(tile => {
        tile.setVisible(showGrid);
    });
}

function toggleHighlight() {
    showHighlight = !showHighlight;
    const btn = document.getElementById('toggle-highlight');
    btn.textContent = `Highlight: ${showHighlight ? 'ON' : 'OFF'}`;
    btn.classList.toggle('active', showHighlight);
    
    // Clear all highlights if turning off
    if (!showHighlight) {
        highlightedTiles.forEach(key => {
            const tile = tileSprites.get(key);
            if (tile) {
                tile.clearTint();
            }
        });
        highlightedTiles.clear();
    }
}

function toggleCollider() {
    showCollider = !showCollider;
    const btn = document.getElementById('toggle-collider');
    btn.textContent = `Collider: ${showCollider ? 'ON' : 'OFF'}`;
    btn.classList.toggle('active', showCollider);
    
    // Toggle physics debug rendering
    if (currentScene) {
        currentScene.physics.world.debugGraphic.clear();
        currentScene.physics.world.drawDebug = showCollider;
        if (showCollider) {
            // Force an immediate update of the debug graphics
            currentScene.physics.world.drawDebug = false;
            currentScene.physics.world.drawDebug = true;
        }
    }
}

// UI update functions
function updatePlayerInfo(player) {
    document.getElementById('player-position').textContent = 
        `X: ${Math.round(player.x)}, Y: ${Math.round(player.y)}`;
    document.getElementById('player-velocity').textContent = 
        `X: ${Math.round(player.body.velocity.x)}, Y: ${Math.round(player.body.velocity.y)}`;
}

function getTouchedTiles(sprite) {
    const touchedTiles = [];
    const spriteLeft = sprite.body.left;
    const spriteRight = sprite.body.right;
    const spriteTop = sprite.body.top;
    const spriteBottom = sprite.body.bottom;

    // Calculate the tile coordinates for each corner of the bounding box
    const startTileX = Math.floor(spriteLeft / TILE_SIZE);
    const endTileX = Math.floor(spriteRight / TILE_SIZE);
    const startTileY = Math.floor(spriteTop / TILE_SIZE);
    const endTileY = Math.floor(spriteBottom / TILE_SIZE);

    // Collect all tiles that the sprite's bounding box overlaps
    for (let y = startTileY; y <= endTileY; y++) {
        for (let x = startTileX; x <= endTileX; x++) {
            const tileIndex = (y * (3840 / TILE_SIZE)) + x;
            touchedTiles.push({ x, y, index: tileIndex });
        }
    }

    return touchedTiles;
}

function updateTileInfo(tileX, tileY) {
    // Basic tile information
    document.getElementById('current-tile').textContent = `X: ${tileX}, Y: ${tileY}`;
    const tileIndex = (tileY * (3840 / TILE_SIZE)) + tileX;
    document.getElementById('tile-index').textContent = tileIndex;

    // Check if there's an object on this tile
    const tileKey = `${tileX},${tileY}`;
    const objectOnTile = worldObjects.get(tileKey);
    
    // Update hover information
    const hoverInfo = document.getElementById('hover-info');
    if (objectOnTile) {
        hoverInfo.innerHTML = `
            <div style="color: #00ff00">Object: ${objectOnTile.type}</div>
            <div>Position: (${Math.round(objectOnTile.object.x)}, ${Math.round(objectOnTile.object.y)})</div>
        `;
    } else {
        hoverInfo.innerHTML = '<div style="color: #666666">Empty Tile</div>';
    }

    // Highlight tiles that the player is touching
    if (player && player.body) {
        const touchedTiles = getTouchedTiles(player);
        
        // Clear previous highlights
        highlightedTiles.forEach(key => {
            const tile = tileSprites.get(key);
            if (tile) {
                tile.clearTint();
            }
        });
        highlightedTiles.clear();
        
        // Add new highlights if enabled
        if (showHighlight) {
            touchedTiles.forEach(tile => {
                const key = `${tile.x},${tile.y}`;
                const tileSprite = tileSprites.get(key);
                if (tileSprite) {
                    tileSprite.setTint(0xFF0000);
                    highlightedTiles.add(key);
                }
            });
        }
    }

    // Update touched tiles display
    if (player && player.body) {
        const touchedTiles = getTouchedTiles(player);
        const touchedTilesElement = document.getElementById('touched-tiles');
        touchedTilesElement.innerHTML = touchedTiles
            .map(tile => {
                const tileHasObject = worldObjects.get(`${tile.x},${tile.y}`);
                const objectInfo = tileHasObject ? ` [${tileHasObject.type}]` : '';
                return `<div>Tile(${tile.x}, ${tile.y}) - Index: ${tile.index}${objectInfo}</div>`;
            })
            .join('');
    }
}

function updateDebugInfo(scene) {
    document.getElementById('fps-counter').textContent = 
        Math.round(scene.game.loop.actualFps);
    document.getElementById('camera-position').textContent = 
        `X: ${Math.round(scene.cameras.main.scrollX)}, Y: ${Math.round(scene.cameras.main.scrollY)}`;
    
    // Update collision box position in world coordinates
    if (player && player.body) {
        document.getElementById('collision-box').textContent = 
            `${player.body.width}x${player.body.height}`;
        document.getElementById('collision-offset').textContent = 
            `${player.body.offset.x}, ${player.body.offset.y}`;
    }
}

function preload() {
    // Load the character atlas
    this.load.atlas('character', 'CQ_SpriteAtlas.png', 'CQ_phaser-atlas.json');
    
    // Create a simple tile texture programmatically
    this.load.on('complete', function() {
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0x00ff00, 0.3); // Thicker lines with semi-transparent green color
        graphics.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        graphics.generateTexture('tile', TILE_SIZE, TILE_SIZE);
        graphics.destroy();
    }, this);
}

function create() {
    // Store scene reference
    currentScene = this;

    // Set up toggle button listeners
    document.getElementById('toggle-grid').addEventListener('click', toggleGrid);
    document.getElementById('toggle-highlight').addEventListener('click', toggleHighlight);
    document.getElementById('toggle-collider').addEventListener('click', toggleCollider);
    
    // Set up zoom slider
    const zoomSlider = document.getElementById('zoom-slider');
    zoomSlider.addEventListener('input', (e) => updateZoom(parseFloat(e.target.value)));
    
    // Set up mouse wheel zoom
    const gameCanvas = document.querySelector('canvas');
    gameCanvas.addEventListener('wheel', handleMouseWheel, { passive: true });
    
    // Set up pinch zoom for Safari/MacOS
    gameCanvas.addEventListener('gesturestart', (e) => e.preventDefault());
    gameCanvas.addEventListener('gesturechange', handlePinchZoom);
    
    // Set up touch events for other devices
    gameCanvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    gameCanvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    gameCanvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    updateZoom(0.4); // Initialize zoom
    // Set up the world bounds
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Create tiles
    for (let y = 0; y < WORLD_HEIGHT; y += TILE_SIZE) {
        for (let x = 0; x < WORLD_WIDTH; x += TILE_SIZE) {
            const tile = this.add.sprite(x + TILE_SIZE/2, y + TILE_SIZE/2, 'tile');
            tile.setInteractive();
            const tileKey = `${Math.floor(x/TILE_SIZE)},${Math.floor(y/TILE_SIZE)}`;
            tileSprites.set(tileKey, tile);
        }
    }

    // Define object types and their properties
    const objectTypes = [
        { key: 'House', frame: 'House', scale: 1, count: 2, allowPartialOffscreen: true, collidable: true, padding: 200 },
        { key: 'Tree', frame: 'Tree', scale: 1, count: 12, allowPartialOffscreen: false, collidable: true, padding: 150 },
        { key: 'Bush', frame: 'Bush', scale: 1, count: 25, allowPartialOffscreen: false, collidable: false, padding: 80 }
    ];
    
    // Place Forge at its designated location
    const forgeX = (FORGE_LOCATION.tileX * TILE_SIZE);
    const forgeY = (FORGE_LOCATION.tileY * TILE_SIZE);
    const forge = this.add.sprite(forgeX, forgeY, 'character', 'Forge');
    forge.setScale(FORGE_LOCATION.scale);
    forge.setOrigin(0, 0);
    
    // Add Forge to physics world
    this.physics.add.existing(forge, true);
    forge.body.setOffset(0, 0);
    forge.body.setSize(forge.displayWidth, forge.displayHeight);
    
    // Store Forge in world objects
    worldObjects.set(`${FORGE_LOCATION.tileX},${FORGE_LOCATION.tileY}`, {
        object: forge,
        type: 'Forge',
        collidable: true,
        padding: 200
    });

    // Function to check if a position is valid (no overlap with existing objects)
    const isValidPosition = (x, y, width, height, requiredPadding) => {
        // Create a rectangle for the new object with its required padding
        const rect1 = new Phaser.Geom.Rectangle(
            x - requiredPadding/2,
            y - requiredPadding/2,
            width + requiredPadding,
            height + requiredPadding
        );
        
        // Check against all existing objects
        for (let [key, obj] of worldObjects) {
            // Each object type might have different padding requirements
            const objPadding = obj.padding || 100;
            const rect2 = new Phaser.Geom.Rectangle(
                obj.object.x - objPadding/2,
                obj.object.y - objPadding/2,
                obj.object.displayWidth + objPadding,
                obj.object.displayHeight + objPadding
            );
            if (Phaser.Geom.Rectangle.Overlaps(rect1, rect2)) {
                return false;
            }
        }
        return true;
    };

    // Place objects randomly on the map
    objectTypes.forEach(type => {
        const frameData = this.textures.get('character').frames[type.frame];
        const width = frameData.width * type.scale;
        const height = frameData.height * type.scale;
        
        for (let i = 0; i < type.count; i++) {
            let attempts = 0;
            let positioned = false;
            
            while (!positioned && attempts < 100) {
                let tileX, tileY;
                if (type.allowPartialOffscreen) {
                    // Allow items to start partially off-screen (up to 2 tiles)
                    const minTileX = -2;
                    const maxTileX = Math.floor(WORLD_WIDTH / TILE_SIZE) + 1;
                    const minTileY = -2;
                    const maxTileY = Math.floor(WORLD_HEIGHT / TILE_SIZE) + 1;
                    tileX = Phaser.Math.Between(minTileX, maxTileX);
                    tileY = Phaser.Math.Between(minTileY, maxTileY);
                } else {
                    // Keep entirely within bounds
                    const maxTileX = Math.floor((WORLD_WIDTH - width) / TILE_SIZE);
                    const maxTileY = Math.floor((WORLD_HEIGHT - height) / TILE_SIZE);
                    tileX = Phaser.Math.Between(0, maxTileX);
                    tileY = Phaser.Math.Between(0, maxTileY);
                }
                
                // Convert tile position to world coordinates, aligned to tile top-left
                const x = tileX * TILE_SIZE;
                const y = tileY * TILE_SIZE;
                
                if (isValidPosition(x, y, width, height, type.padding)) {
                    const object = this.add.sprite(x, y, 'character', type.frame);
                    object.setScale(type.scale);
                    
                    // Set origin to top-left (0,0) instead of center (0.5,0.5)
                    object.setOrigin(0, 0);
                    
                    // Add to physics world
                    this.physics.add.existing(object, true); // true makes it static
                    
                    // Adjust physics body to match new origin
                    object.body.setOffset(0, 0);
                    object.body.setSize(object.displayWidth, object.displayHeight);
                    
                    // Store in our objects map with all properties
                    const tileX = Math.floor(x / TILE_SIZE);
                    const tileY = Math.floor(y / TILE_SIZE);
                    worldObjects.set(`${tileX},${tileY}`, {
                        object,
                        type: type.key,
                        collidable: type.collidable,
                        padding: type.padding
                    });
                    
                    positioned = true;
                }
                attempts++;
            }
        }
    });

    // Convert spawn tile coordinates to world coordinates (center of tile)
    const playerX = (SPAWN_LOCATION.tileX * TILE_SIZE) + (TILE_SIZE / 2);
    const playerY = (SPAWN_LOCATION.tileY * TILE_SIZE) + (TILE_SIZE / 2);
    
    // Add player at the specific tile
    player = this.add.sprite(playerX, playerY, 'character', 'Critter');
    player.setOrigin(0.5, 0.5);

    // Enable physics on the player
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);
    player.body.setSize(256, 328); // Set collision box to match sprite size
    player.body.setOffset(0, 0);

    // Add collisions between player and collidable world objects
    worldObjects.forEach(({ object, collidable }) => {
        if (collidable) {
            // this.physics.add.collider(player, object);
        }
    });

    // Set up camera
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setScroll(playerX - (this.cameras.main.width / 2), playerY - (this.cameras.main.height / 2));
    this.cameras.main.startFollow(player, true);
    this.cameras.main.setZoom(0.4); // Match initial zoom level
    
    // Update zoom slider to match initial zoom
    document.getElementById('zoom-slider').value = '0.4';
    
    // Update initial tile info
    currentTile.x = SPAWN_LOCATION.tileX;
    currentTile.y = SPAWN_LOCATION.tileY;
    updateTileInfo(SPAWN_LOCATION.tileX, SPAWN_LOCATION.tileY);

    // Add debug info
    document.getElementById('debug-info').innerHTML += `
        <p>Collision Box: <span id="collision-box">256x328</span></p>
        <p>Box Offset: <span id="collision-offset">0, 0</span></p>
    `;

    // Set up cursor keys
    cursors = this.input.keyboard.createCursorKeys();

    // Mouse move handler for tile tracking
    this.input.on('pointermove', function (pointer) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / TILE_SIZE);
        const tileY = Math.floor(worldPoint.y / TILE_SIZE);
        
        if (tileX !== currentTile.x || tileY !== currentTile.y) {
            currentTile.x = tileX;
            currentTile.y = tileY;
            updateTileInfo(tileX, tileY);
        }
    }, this);

    // Click/tap handler for movement
    this.input.on('pointerdown', function (pointer) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        targetX = worldPoint.x;
        targetY = worldPoint.y;
    }, this);
}

function update() {
    // Calculate speed based on zoom level (faster when zoomed out)
    const zoomFactor = Math.max(0.1, currentZoom); // Prevent division by zero
    const speed = BASE_SPEED * (1 / zoomFactor); // Inverse relationship with zoom

    // Reset velocity
    player.body.setVelocity(0);

    // Handle click/tap movement if target exists
    if (targetX !== null && targetY !== null) {
        const dx = targetX - player.x;
        const dy = targetY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) { // Stop when close enough to target
            const angle = Math.atan2(dy, dx);
            player.body.setVelocityX(Math.cos(angle) * speed);
            player.body.setVelocityY(Math.sin(angle) * speed);
        } else {
            targetX = null;
            targetY = null;
        }
    }

    // Handle keyboard movement
    if (targetX === null && targetY === null) { // Only use keyboard if not moving to target
        if (cursors.left.isDown) {
            player.body.setVelocityX(-speed);
        } else if (cursors.right.isDown) {
            player.body.setVelocityX(speed);
        }

        if (cursors.up.isDown) {
            player.body.setVelocityY(-speed);
        } else if (cursors.down.isDown) {
            player.body.setVelocityY(speed);
        }

        // Normalize and scale the velocity so that player can't move faster diagonally
        if (player.body.velocity.x !== 0 || player.body.velocity.y !== 0) {
            player.body.velocity.normalize().scale(speed);
        }
    }

    // Update UI elements
    updatePlayerInfo(player);
    updateTileInfo(
        Math.floor(player.x / TILE_SIZE),
        Math.floor(player.y / TILE_SIZE)
    );
    updateDebugInfo(this);
}
