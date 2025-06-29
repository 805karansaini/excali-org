import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist as other builds also use it

    rollupOptions: {
      input: {
        // Unified content script entry point
        'content-unified': './content_script/unified-entry.ts'
      },

      output: {
        // Place in assets directory for Chrome extension
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        format: 'iife', // Use IIFE format for content scripts
        name: 'ExcaliOrganizer',
        compact: false, // Ensure readable formatting

        // No code splitting for content scripts to avoid module import issues
        manualChunks: undefined
      },

      // External dependencies that should not be bundled
      external: [
        // Chrome APIs are provided by the browser
        'chrome'
      ]
    },

    // Optimization settings
    minify: 'esbuild', // Fast minification
    sourcemap: process.env.NODE_ENV === 'development', // Source maps for development

    // CSS handling
    cssCodeSplit: false, // Inline CSS for content script

    // Bundle size limits
    chunkSizeWarningLimit: 1000, // Warn if chunks exceed 1MB

    // Build performance
    reportCompressedSize: false, // Skip gzip reporting for faster builds
  },

  // Development server config (for HMR during development)
  server: {
    port: 3001,
    strictPort: true
  },

  // CSS preprocessing
  css: {
    modules: {
      // CSS modules configuration for component isolation
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    },

    // PostCSS configuration for CSS optimization
    postcss: {
      plugins: [
        // Add autoprefixer and other PostCSS plugins as needed
      ]
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      // Path aliases for cleaner imports
      '@': resolve(__dirname, './content_script'),
      '@shared': resolve(__dirname, './shared'),
    }
  },

  // Define global constants
  define: {
    // Environment variables
    __DEV__: process.env.NODE_ENV === 'development',
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),

    // Feature flags
    __ENABLE_DEV_TOOLS__: process.env.NODE_ENV === 'development',
    __ENABLE_LOGGING__: process.env.NODE_ENV === 'development'
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'dexie'
    ],

    // Force optimization of specific dependencies
    force: process.env.NODE_ENV === 'development'
  },

  // Build-specific environment variables
  envPrefix: ['VITE_', 'EXCALIDRAW_'],

  // Worker configuration for potential future use
  worker: {
    format: 'es'
  }
})
