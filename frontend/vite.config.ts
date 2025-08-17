import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        vueJsx(),
        vueDevTools(),
        (monacoEditorPlugin as any).default({
            languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html', 'css']
        })
    ],
    define: {
        // Define Monaco Editor worker paths
        'process.env': {}
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    optimizeDeps: {
        include: [
            'monaco-editor/esm/vs/editor/editor.api',
            'monaco-editor/esm/vs/editor/editor.worker',
            'monaco-editor/esm/vs/language/typescript/ts.worker'
        ]
    },
    build: {
        minify: 'terser',
        terserOptions: {
            mangle: false,
            keep_fnames: true,
            keep_classnames: true
        },
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name].js`,
                chunkFileNames: `assets/[name].js`,
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith('.ttf') || assetInfo.name?.endsWith('.woff') || assetInfo.name?.endsWith('.woff2')) {
                        return 'assets/fonts/[name].[ext]';
                    }
                    return 'assets/[name].[ext]';
                }
            }
        },
        sourcemap: true,
        outDir: 'dist',
        emptyOutDir: true,
        target: 'esnext',
        assetsInlineLimit: 0, // Don't inline assets, keep them as separate files
    }
})
