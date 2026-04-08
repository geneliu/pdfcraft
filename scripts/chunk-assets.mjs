/**
 * scripts/chunk-assets.mjs
 * 
 * Splits large files (>24MB) into 20MB chunks to bypass Cloudflare Pages limits.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// Use ~20MB chunk size - safely under Cloudflare's 25MB limit
const CHUNK_SIZE = 20 * 1024 * 1024; 
const TARGET_DIR = join(process.cwd(), 'out', 'libreoffice-wasm');

async function processFile(filePath) {
    if (!existsSync(filePath)) return;
    
    const stat = statSync(filePath);
    if (stat.size <= CHUNK_SIZE) return;

    const fileName = filePath.split('/').pop();
    console.log(`[chunking] Splitting ${fileName} (${(stat.size / 1024 / 1024).toFixed(1)}MB)...`);

    const buffer = readFileSync(filePath);
    let offset = 0;
    let chunkIndex = 0;

    while (offset < buffer.length) {
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        const chunkPath = `${filePath}.part_${chunkIndex}`;
        writeFileSync(chunkPath, chunk);
        offset += CHUNK_SIZE;
        chunkIndex++;
    }

    const manifest = {
        filename: fileName,
        chunks: chunkIndex,
        totalSize: stat.size,
        chunkSize: CHUNK_SIZE
    };

    writeFileSync(`${filePath}.manifest.json`, JSON.stringify(manifest, null, 2));
    unlinkSync(filePath);
    
    console.log(`[chunking]   → Created ${chunkIndex} chunks and manifest.`);
}

async function main() {
    if (!existsSync(TARGET_DIR)) {
        console.log('[chunking] Target directory not found in out/, skipping.');
        return;
    }

    const files = readdirSync(TARGET_DIR);
    for (const file of files) {
        const filePath = join(TARGET_DIR, file);
        // Stats in readdir might be stale if we're not careful, but re-statting inside processFile is safe
        const stat = statSync(filePath);
        if (stat.isFile() && stat.size > CHUNK_SIZE) {
            // We chunk .wasm, .data, and even .gz files if they are too large
            await processFile(filePath);
        }
    }
    
    console.log('[chunking] Completed successfully.');
}

main().catch(err => {
    console.error('[chunking] Error:', err);
    process.exit(1);
});
