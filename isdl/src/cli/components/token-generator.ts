import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Entry } from '../../language/generated/ast.js';

export function generateCanvasToken(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "canvas");
    const generatedFilePath = path.join(generatedFileDir, `token.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    export default class ${entry.config.name}Token extends Token {
        /** @inheritDoc */
        _drawBar(number, bar, data) {
            const resource = foundry.utils.getProperty(this.document.actor.system, data.attribute);

            if (resource.temp <= 0) {
                return super._drawBar(number, bar, data);
            }

            const displayMax = resource.max;

            const tempPct = Math.clamp(resource.temp, 0, displayMax) / displayMax;
            const colorPct = Math.clamp(resource.value, 0, displayMax) / displayMax;

            // Determine the container size (logic borrowed from core)
            const w = this.w;
            let h = Math.max((canvas.dimensions.size / 12), 8);
            if (this.document.height >= 2) h *= 1.6;
            const bs = Math.clamp(h / 8, 1, 2);
            const bs1 = bs + 1;

            // Determine the color to use
            const blk = 0x000000;
            let color;
            if ( number === 0 ) color = Color.fromRGB([(1-(colorPct/2)), colorPct, 0]);
            else color = Color.fromRGB([(0.5 * colorPct), (0.7 * colorPct), 0.5 + (colorPct / 2)]);

            // Overall bar container
            bar.clear();
            bar.beginFill(blk, 0.5).lineStyle(bs, blk, 1.0).drawRoundedRect(0, 0, w, h, 3);

            // Health bar
            bar.beginFill(color, 1.0).lineStyle(bs, blk, 1.0).drawRoundedRect(0, 0, colorPct*w, h, 2);
        
            function getBlendedContrast(color, blendFactor = 0.3) {
                // Convert color to hex string
                let hex = color.toString(16).padStart(6, "0");
            
                // Extract RGB components
                let r = parseInt(hex.substring(0, 2), 16);
                let g = parseInt(hex.substring(2, 4), 16);
                let b = parseInt(hex.substring(4, 6), 16);
            
                // Calculate luminance
                let luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            
                // Determine base contrast color (black or white)
                let baseContrast = luminance > 0.5 ? 0x000000 : 0xFFFFFF;
            
                // Extract RGB from base contrast
                let bcR = (baseContrast >> 16) & 0xFF;
                let bcG = (baseContrast >> 8) & 0xFF;
                let bcB = baseContrast & 0xFF;
            
                // Blend original color with contrast color
                let blendedR = Math.round(r * (1 - blendFactor) + bcR * blendFactor);
                let blendedG = Math.round(g * (1 - blendFactor) + bcG * blendFactor);
                let blendedB = Math.round(b * (1 - blendFactor) + bcB * blendFactor);
            
                // Return new blended color
                return (blendedR << 16) | (blendedG << 8) | blendedB;
            }

            // Calculate a temporary color that is a lighter shade than color
            const tempColor = number === 0 ? 0x33AAFF : getBlendedContrast(color);

            // Temporary health bar
            
            const blur = new PIXI.filters.BlurFilter();
            blur.blur = 1; // Adjust for stronger glow
            
            const colorMatrix = new PIXI.filters.ColorMatrixFilter();
            colorMatrix.brightness(1.2); // Increase brightness

            const tempBar = new PIXI.Graphics();
            tempBar.filters = [blur, colorMatrix];
            tempBar.beginFill(tempColor, 1.0).lineStyle(0).drawRoundedRect(bs1, bs1, (tempPct*w)-(2*bs1), h-(2*bs1), 1)
        
            bar.addChild(tempBar);

            // Animation - Flashing (Opacity Pulse)
            canvas.app.ticker.add((delta) => {
                tempBar.alpha = 0.7 + 0.3 * Math.sin(performance.now() / 1000);
            });

            // Set position
            let posY = number === 0 ? this.h - h : 0;
            bar.position.set(0, posY);
        }

        /* -------------------------------------------- */

        static onTargetToken(user, token, targeted) {
            if ( !targeted ) return;
            if ( !token.hasDynamicRing ) return;
            const color = Color.from(user.color);
            token.ring.flashColor(color, { duration: 500, easing: token.ring.constructor.easeTwoPeaks });
        }
    }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode), 'utf-8');
}

export function generateTokenDocument(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "documents");
    const generatedFilePath = path.join(generatedFileDir, `token.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    export default class ${entry.config.name}TokenDocument extends TokenDocument {
        /** @inheritDoc */
        getBarAttribute(barName, options={}) {
            const data = super.getBarAttribute(barName, options);
            if ( data === null ) return;
            const resource = foundry.utils.getProperty(this.actor.system, data.attribute);
            data.value += resource.temp;
            return data;
        }
    }`.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode), 'utf-8');
}
