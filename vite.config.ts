import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/**
 * ✅ Makes "@/x" resolve like:
 * 1) /src/x  (priority)
 * 2) /x      (project root fallback)
 *
 * So:
 * - "@/components/..." -> src/components/...
 * - "@/model/..."      -> model/...
 * - "@/shared/..."     -> shared/...
 * - etc...
 */
function atAliasPreferSrcThenRoot() {
  const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"]

  function existsFile(p: string) {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile()
    } catch {
      return false
    }
  }

  function existsDir(p: string) {
    try {
      return fs.existsSync(p) && fs.statSync(p).isDirectory()
    } catch {
      return false
    }
  }

  function tryResolve(base: string) {
    // direct file (already has extension)
    if (existsFile(base)) return base

    // file with extension
    for (const ext of exts) {
      const p = `${base}${ext}`
      if (existsFile(p)) return p
    }

    // directory -> index.*
    if (existsDir(base)) {
      for (const ext of exts) {
        const p = path.join(base, `index${ext}`)
        if (existsFile(p)) return p
      }
    }

    return null
  }

  return {
    name: "at-alias-prefer-src-then-root",
    enforce: "pre" as const,
    resolveId(source: string) {
      if (!source.startsWith("@/")) return null

      const rel = source.slice(2) // remove "@/"

      // ✅ 1) Try src first
      const fromSrc = tryResolve(path.resolve(__dirname, "src", rel))
      if (fromSrc) return fromSrc

      // ✅ 2) Then try project root
      const fromRoot = tryResolve(path.resolve(__dirname, rel))
      if (fromRoot) return fromRoot

      return null
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), atAliasPreferSrcThenRoot()],
})
