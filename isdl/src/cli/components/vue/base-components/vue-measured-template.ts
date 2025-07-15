import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';

export default function generateMeasuredTemplateComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `measured-template.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject, watchEffect, onMounted, onUnmounted, nextTick, watch } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            visibility: String,
            editMode: Boolean,
            primaryColor: String,
            secondaryColor: String,
            tertiaryColor: String,
            icon: String,
            disabled: Boolean
        });

        const document = inject("rawDocument");
        
        const expanded = ref(false);
        const canvasRef = ref(null);
        let pixiApp = null;
        let templateGraphics = null;

        const expandIcon = computed(() => {
            return expanded.value ? "fa-solid fa-caret-up" : "fa-solid fa-caret-down";
        });
        
        const type = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".type") || "circle",
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".type", newValue)
        });

        const direction = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".direction") || 0,
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".direction", newValue)
        });
        
        const angle = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".angle") || 60,
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".angle", newValue)
        });
        
        const distance = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".distance") || 30,
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".distance", newValue)
        });
        
        const width = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".width") || 5,
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".width", newValue)
        });

        const summary = computed(() => {
            let sum = \`\${direction.value}° \${type.value} (\${distance.value} squares)\`;
            if (type.value === 'cone') sum += \` \${angle.value}° angle\`;
            if (type.value === 'ray') sum += \` \${width.value} squares wide\`;
            return sum;
        });

        const getLabel = computed(() => {
            const localized = game.i18n.localize(props.label);
            if (props.icon) {
                return \`<i class="fa-solid \${props.icon}"></i> \${localized}\`;
            }
            return localized;
        });


        // PIXI Drawing Functions
        const initializePixi = async () => {
            if (!canvasRef.value || pixiApp) return;
            
            try {
                const { width, height } = getCanvasSize();
                
                pixiApp = new PIXI.Application({
                    view: canvasRef.value,
                    width,
                    height,
                    backgroundColor: 0xf8f9fa,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });

                // Draw grid background
                drawGrid();
                
                // Create template graphics container
                templateGraphics = new PIXI.Graphics();
                pixiApp.stage.addChild(templateGraphics);
                
                // Initial draw
                drawTemplate();
            } catch (error) {
                console.warn("PIXI initialization failed:", error);
            }
        };
        
        const getCanvasSize = () => {
            const bufferSquares = 2;
            const canvasSize = 150; // Always 150px x 150px
            
            // Calculate required grid squares to display
            let maxDimension = distance.value;
            
            if (type.value === 'cone') {
                // For cones, consider the width at the end
                const endWidth = Math.tan((angle.value / 2) * Math.PI / 180) * distance.value * 2;
                maxDimension = Math.max(distance.value, endWidth);
            } else if (type.value === 'ray') {
                maxDimension = Math.max(distance.value, width.value);
            }
            
            // Total grid squares needed (template + buffer on all sides)
            const totalGridSquares = (maxDimension * 2) + (bufferSquares * 2);
            const gridSize = canvasSize / totalGridSquares;
            
            return { 
                width: canvasSize, 
                height: canvasSize,
                gridSize: gridSize,
                totalGridSquares: totalGridSquares
            };
        };

        const resizeCanvas = () => {
            if (!pixiApp) return;
            
            const { width, height } = getCanvasSize();
            pixiApp.renderer.resize(width, height);
            
            // Clear and redraw everything
            pixiApp.stage.removeChildren();
            drawGrid();
            templateGraphics = new PIXI.Graphics();
            pixiApp.stage.addChild(templateGraphics);
            drawTemplate();
        };

        const drawGrid = () => {
            if (!pixiApp) return;
            
            const gridGraphics = new PIXI.Graphics();
            const { gridSize } = getCanvasSize();
            const width = pixiApp.screen.width;
            const height = pixiApp.screen.height;
            
            // Always offset grid by half a square so canvas center aligns with grid square center
            const offset = gridSize / 2;
            
            console.log("Drawing grid with offset:", offset, "gridSize:", gridSize, "distance:", distance.value);
            
            gridGraphics.lineStyle(1, 0xe0e0e0, 0.8);
            
            // Vertical lines
            for (let x = offset; x <= width; x += gridSize) {
                gridGraphics.moveTo(x, 0);
                gridGraphics.lineTo(x, height);
            }
            
            // Horizontal lines
            for (let y = offset; y <= height; y += gridSize) {
                gridGraphics.moveTo(0, y);
                gridGraphics.lineTo(width, y);
            }
            
            pixiApp.stage.addChild(gridGraphics);
        };
        
        const drawTemplate = () => {
            if (!templateGraphics || !pixiApp) return;
            
            templateGraphics.clear();
            
            const { gridSize } = getCanvasSize();
            const directionRad = toRadians(direction.value);
            
            // Always center in grid square (canvas center)
            const centerX = pixiApp.screen.width / 2;
            const centerY = pixiApp.screen.height / 2;
            
            // Convert grid units to pixels for Foundry shape functions
            const distancePixels = distance.value * gridSize;
            const widthPixels = width.value * gridSize;
            
            // Set template style
            templateGraphics.lineStyle(3, 0xff6b6b, 1);
            templateGraphics.beginFill(0xff6b6b, 0.25);
            
            switch (type.value) {
                case 'circle':
                    templateGraphics.drawCircle(centerX, centerY, distancePixels);
                    break;
                case 'rectangle':
                    templateGraphics.drawRect(
                        centerX - distancePixels/2, 
                        centerY - distancePixels/2, 
                        distancePixels, 
                        distancePixels
                    );
                    break;
                case 'cone':
                    const coneShape = getConeShape(directionRad, angle.value, distancePixels);
                    const conePoints = [];
                    for (let i = 0; i < coneShape.points.length; i += 2) {
                        conePoints.push(centerX + coneShape.points[i]);
                        conePoints.push(centerY + coneShape.points[i + 1]);
                    }
                    templateGraphics.drawPolygon(conePoints);
                    break;
                case 'ray':
                    const rayShape = getRayShape(directionRad, distancePixels, widthPixels);
                    const rayPoints = [];
                    for (let i = 0; i < rayShape.points.length; i += 2) {
                        rayPoints.push(centerX + rayShape.points[i]);
                        rayPoints.push(centerY + rayShape.points[i + 1]);
                    }
                    templateGraphics.drawPolygon(rayPoints);
                    break;
            }
            
            templateGraphics.endFill();
            
            // Draw origin point
            templateGraphics.lineStyle(0);
            templateGraphics.beginFill(0x333333, 1);
            templateGraphics.drawCircle(centerX, centerY, Math.max(2, gridSize * 0.15));
            templateGraphics.endFill();
            
            // Draw direction indicator
            templateGraphics.lineStyle(2, 0x333333, 1);
            templateGraphics.moveTo(centerX, centerY);
            templateGraphics.lineTo(
                centerX + Math.cos(directionRad) * (gridSize * 0.8),
                centerY + Math.sin(directionRad) * (gridSize * 0.8)
            );
        };

        // Helper function to simulate Ray.fromAngle
        const createRay = (x, y, angle, distance) => {
            return {
                A: { x, y },
                B: { 
                    x: x + Math.cos(angle) * distance,
                    y: y + Math.sin(angle) * distance
                },
                dx: Math.cos(angle) * distance,
                dy: Math.sin(angle) * distance
            };
        };

        // Helper function to convert degrees to radians
        const toRadians = (degrees) => degrees * (Math.PI / 180);

        /**
         * Get a Conical area of effect given a direction, angle, and distance
         * @param {number} direction
         * @param {number} angle
         * @param {number} distance
         * @returns {PIXI.Polygon}
         */
        const getConeShape = (direction, angle, distance) => {
            angle = angle || 90;
            const coneType = game.settings.get("core", "coneTemplateType"); // Default to round cones
            
            // For round cones - approximate the shape with a ray every 3 degrees
            let angles;
            if (coneType === "round") {
                const da = Math.min(angle, 3);
                const numRays = Math.floor(angle / da);
                angles = Array.from({length: numRays + 1}, (_, i) => (angle / -2) + (i * da));
                if (angles[angles.length - 1] !== angle / 2) {
                    angles.push(angle / 2);
                }
            } else {
                // For flat cones, direct point-to-point
                angles = [(angle / -2), (angle / 2)];
                distance /= Math.cos(toRadians(angle / 2));
            }
            
            // Get the cone shape as a polygon
            const rays = angles.map(a => createRay(0, 0, direction + toRadians(a), distance + 1));
            const points = rays.reduce((arr, r) => {
                return arr.concat([r.B.x, r.B.y]);
            }, [0, 0]).concat([0, 0]);
            return new PIXI.Polygon(points);
        };

        /**
         * Get a rotated Rectangular area of effect given a width, height, and direction
         * @param {number} direction
         * @param {number} distance
         * @param {number} width
         * @returns {PIXI.Polygon}
         */
        const getRayShape = (direction, distance, width) => {
            const up = createRay(0, 0, direction - Math.PI/2, (width / 2) + 1);
            const down = createRay(0, 0, direction + Math.PI/2, (width / 2) + 1);
            const l1 = createRay(up.B.x, up.B.y, direction, distance + 1);
            const l2 = createRay(down.B.x, down.B.y, direction, distance + 1);
            
            // Create Polygon shape
            const points = [down.B.x, down.B.y, up.B.x, up.B.y, l1.B.x, l1.B.y, l2.B.x, l2.B.y];
            return new PIXI.Polygon(points);
        };

        const destroyPixi = () => {
            if (pixiApp) {
                pixiApp.destroy(true, true);
                pixiApp = null;
                templateGraphics = null;
            }
        };

        // Watch for changes and redraw/resize
        watchEffect(() => {
            if (expanded.value && pixiApp) {
                // Use nextTick to ensure all reactive values are updated
                nextTick(() => {
                    resizeCanvas();
                });
            }
        });

        // Separate watcher for individual property changes
        watchEffect(() => {
            // Watch these specific values to trigger updates
            const currentType = type.value;
            const currentDirection = direction.value;
            const currentDistance = distance.value;
            const currentAngle = angle.value;
            const currentWidth = width.value;
            
            if (expanded.value && pixiApp && templateGraphics) {
                nextTick(() => {
                    drawTemplate();
                });
            }
        });
        
        watch(distance, () => {
            if (expanded.value && pixiApp) {
                nextTick(() => {
                    resizeCanvas();
                });
            }
        });

        // Watch for expansion changes
        watchEffect(async () => {
            if (expanded.value) {
                await nextTick();
                await nextTick(); // Double nextTick to ensure DOM and reactive values are ready
                initializePixi();
            }
        });

        onMounted(() => {
            if (expanded.value) {
                initializePixi();
            }
        });

        onUnmounted(() => {
            destroyPixi();
        });
        
        const onPlace = () => {
            console.log("Placing template at current cursor position");
            game.system.measuredTemplatePreviewClass.place({
                type: type.value,
                distance: distance.value,
                direction: direction.value,
                angle: angle.value,
                width: width.value
            }, document.sheet);
        };
        
    </script>

    <template>
        <v-input class="isdl-tracker isdl-measured-template">
            <template #default>
                <v-field 
                    class="v-field--active"
                    density="compact"
                    variant="outlined"
                >
                    <template #label>
                        <span v-html="getLabel" />
                    </template>
                    <template #append-inner>
                        <v-icon 
                            icon="fa-solid fa-border-outer" 
                            class="map-icon" 
                            @click.stop="onPlace"
                            data-tooltip="Place"
                            :color="primaryColor" />
                        <v-icon
                            :icon="expandIcon"
                            @click.stop="expanded = !expanded"
                            class="v-select__menu-icon"
                        />
                    </template>
                    <div class="tracker-content flexcol">
                        <div class="d-flex tracker-inner-content">
                            <span v-html="summary" />
                        </div>
                        <v-expand-transition>
                            <div v-show="expanded" class="template-expanded-content" style="margin-top: 1rem;">
                                <div class="template-controls">
                                    <div class="d-flex flex-row">
                                        <v-select
                                            v-model="type"
                                            :name="systemPath + '.type'"
                                            :items="[
                                                { title: 'Circle', value: 'circle' },
                                                { title: 'Cone', value: 'cone' },
                                                { title: 'Rectangle', value: 'rectangle' },
                                                { title: 'Ray', value: 'ray' }
                                            ]"
                                            label="Type"
                                            density="compact"
                                            variant="outlined"
                                            class="control-field slim-number"
                                            :hide-details="true"
                                            :tile="true"
                                            :disabled="disabled"
                                        />
                                        <v-number-input
                                            v-model="direction"
                                            :name="systemPath + '.direction'"
                                            label="Direction (°)"
                                            controlVariant="stacked"
                                            density="compact"
                                            variant="outlined"
                                            class="control-field slim-number"
                                            :hide-details="true"
                                            :tile="true"
                                            :min="0"
                                            :max="360"
                                            :step="0.5"
                                            :precision="1"
                                            :disabled="disabled"
                                        />
                                    </div>
                                    <div class="d-flex flex-row" style="margin-top: 1rem;">
                                        <v-number-input
                                            v-model="distance"
                                            :name="systemPath + '.distance'"
                                            label="Distance (grid units)"
                                            controlVariant="stacked"
                                            density="compact"
                                            variant="outlined"
                                            class="control-field"
                                            :hide-details="true"
                                            :tile="true"
                                            :min="0"
                                            :precision="1"
                                            :step="0.5"
                                            :disabled="disabled"
                                        />
                                        <v-number-input
                                            v-if="type === 'cone'"
                                            v-model="angle"
                                            :name="systemPath + '.angle'"
                                            label="Angle (°)"
                                            controlVariant="stacked"
                                            density="compact"
                                            variant="outlined"
                                            class="control-field slim-number"
                                            :hide-details="true"
                                            :tile="true"
                                            :min="0"
                                            :max="360"
                                            :step="0.5"
                                            :precision="1"
                                            :disabled="disabled"
                                        />
                                        <v-number-input
                                            v-if="type === 'ray'"
                                            v-model="width"
                                            :name="systemPath + '.width'"
                                            label="Width (grid units)"
                                            controlVariant="stacked"
                                            density="compact"
                                            variant="outlined"
                                            class="control-field slim-number"
                                            :hide-details="true"
                                            :tile="true"
                                            :min="0"
                                            :step="0.5"
                                            :precision="1"
                                            :disabled="disabled"
                                        />
                                    </div>
                                </div>
                                <div class="template-preview" style="display: flex; margin-top: 0.5rem;">
                                    <canvas 
                                        ref="canvasRef"
                                        class="template-canvas"
                                        style="margin-left: auto; margin-right: auto;"
                                    ></canvas>
                                </div>
                            </div>
                        </v-expand-transition>
                    </div>
                </v-field>
            </template>
        </v-input>
    </template>
    `;
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
