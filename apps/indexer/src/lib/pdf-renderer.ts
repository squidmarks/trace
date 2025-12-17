import sharp from "sharp"
import { promises as fs } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { randomBytes } from "crypto"
import { exec } from "child_process"
import { promisify } from "util"
import logger from "./logger.js"

const execAsync = promisify(exec)

export interface RenderOptions {
  dpi?: number // Default: 150
  quality?: number // JPEG quality 1-100, Default: 85
}

export interface RenderedPage {
  pageNumber: number
  imageData: string // base64 encoded JPEG
  width: number
  height: number
}

/**
 * Render a PDF document to JPEG images
 * @param pdfBuffer - PDF file as Buffer
 * @param options - Rendering options
 * @returns Array of rendered pages with base64 images
 */
export async function renderPdfToImages(
  pdfBuffer: Buffer,
  options: RenderOptions = {}
): Promise<RenderedPage[]> {
  const dpi = options.dpi || 150
  const quality = options.quality || 85

  logger.info(`📄 Starting PDF render (DPI: ${dpi}, Quality: ${quality})`)

  // Create temporary directory for this render job
  const tempDir = join(tmpdir(), `trace-pdf-${randomBytes(8).toString("hex")}`)
  const pdfPath = join(tempDir, "input.pdf")
  const outputDir = join(tempDir, "output")

  try {
    // Create temp directories
    await fs.mkdir(tempDir, { recursive: true })
    await fs.mkdir(outputDir, { recursive: true })

    // Write PDF to temp file
    await fs.writeFile(pdfPath, pdfBuffer)

    // Convert PDF to images using system Poppler (pdftoppm)
    // -png: output PNG format
    // -r: resolution (DPI)
    const outputPrefix = join(outputDir, "page")
    const command = `pdftoppm -png -r ${dpi} "${pdfPath}" "${outputPrefix}"`
    
    logger.debug(`   Running: ${command}`)
    
    await execAsync(command)

    // Read generated images
    const files = await fs.readdir(outputDir)
    const imageFiles = files
      .filter((f) => f.endsWith(".png"))
      .sort((a, b) => {
        // Sort by page number (page-1.png, page-2.png, etc.)
        const aNum = parseInt(a.match(/\d+/)?.[0] || "0")
        const bNum = parseInt(b.match(/\d+/)?.[0] || "0")
        return aNum - bNum
      })

    logger.info(`📄 PDF rendered: ${imageFiles.length} pages`)

    const renderedPages: RenderedPage[] = []

    // Process each page
    for (let i = 0; i < imageFiles.length; i++) {
      const pageNum = i + 1
      const imagePath = join(outputDir, imageFiles[i])

      logger.debug(`   Processing page ${pageNum}/${imageFiles.length}...`)

      // Read PNG and convert to JPEG with sharp
      const pngBuffer = await fs.readFile(imagePath)
      const image = sharp(pngBuffer)
      const metadata = await image.metadata()

      const jpegBuffer = await image
        .jpeg({
          quality: quality,
          mozjpeg: true,
        })
        .toBuffer()

      // Convert to base64
      const base64Image = jpegBuffer.toString("base64")

      renderedPages.push({
        pageNumber: pageNum,
        imageData: base64Image,
        width: metadata.width || 0,
        height: metadata.height || 0,
      })

      logger.debug(
        `   ✅ Page ${pageNum} processed (${Math.round(jpegBuffer.length / 1024)}KB)`
      )
    }

    logger.info(
      `✅ PDF render complete: ${imageFiles.length} pages, ${Math.round(
        renderedPages.reduce((sum, p) => sum + p.imageData.length, 0) / 1024
      )}KB total`
    )

    return renderedPages
  } catch (error) {
    logger.error("❌ PDF render failed:", error)
    throw new Error(
      `Failed to render PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      logger.warn("Failed to cleanup temp directory:", cleanupError)
    }
  }
}

/**
 * Fetch a PDF from a URL and render it
 * @param url - URL to fetch PDF from
 * @param options - Rendering options
 * @returns Array of rendered pages
 */
export async function renderPdfFromUrl(
  url: string,
  options: RenderOptions = {}
): Promise<RenderedPage[]> {
  logger.info(`🌐 Fetching PDF from URL: ${url}`)

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    logger.info(`✅ PDF fetched: ${Math.round(buffer.length / 1024 / 1024)}MB`)

    return await renderPdfToImages(buffer, options)
  } catch (error) {
    logger.error("❌ PDF fetch failed:", error)
    throw new Error(
      `Failed to fetch PDF from URL: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}

