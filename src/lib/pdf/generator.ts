import PDFDocument from 'pdfkit'
import { Readable } from 'stream'

export interface CostData {
  date: string
  cost_usd: number
  service_category?: string | null
  resource_name?: string | null
  resource_type?: string | null
  location?: string | null
}

export interface TenantInfo {
  name: string
  azure_tenant_id: string
}

export interface OrganizationBranding {
  logo_url?: string | null
  primary_color?: string | null
  company_name?: string | null
}

export interface ReportOptions {
  title: string
  period: { start: string; end: string }
  tenantInfo: TenantInfo
  costData: CostData[]
  totalCost: number
  branding?: OrganizationBranding
  generatedBy?: string
  generatedAt?: Date
}

/**
 * Generate a PDF cost report
 * @param options Report configuration options
 * @returns Buffer containing the PDF document
 */
export async function generateCostReportPDF(
  options: ReportOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: options.title,
          Author: options.branding?.company_name || 'CloudHalo',
          Subject: 'Azure Cost Report',
          Keywords: 'azure, cost, report, cloud',
        },
      })

      const chunks: Buffer[] = []

      // Collect PDF data into chunks
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Colors
      const primaryColor = options.branding?.primary_color || '#0078D4'
      const textColor = '#333333'
      const lightGray = '#F5F5F5'
      const borderColor = '#E0E0E0'

      // Add header with branding
      addHeader(doc, options, primaryColor)

      // Add report title and metadata
      doc.moveDown(2)
      doc.fontSize(24).fillColor(textColor).text(options.title, { align: 'left' })

      doc.moveDown(0.5)
      doc
        .fontSize(12)
        .fillColor('#666666')
        .text(`Report Period: ${formatDate(options.period.start)} - ${formatDate(options.period.end)}`)
      doc.text(`Tenant: ${options.tenantInfo.name}`)
      doc.text(`Azure Tenant ID: ${options.tenantInfo.azure_tenant_id}`)

      // Add cost summary section
      doc.moveDown(2)
      addSummarySection(doc, options.totalCost, primaryColor)

      // Add cost breakdown table
      doc.moveDown(2)
      addCostBreakdownTable(doc, options.costData, primaryColor, lightGray, borderColor)

      // Add service category breakdown if available
      const categoryData = aggregateByCategory(options.costData)
      if (categoryData.length > 0) {
        doc.addPage()
        addCategoryBreakdown(doc, categoryData, primaryColor, lightGray, borderColor)
      }

      // Add footer
      addFooter(doc, options, textColor)

      // Finalize PDF
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

function addHeader(
  doc: PDFKit.PDFDocument,
  options: ReportOptions,
  primaryColor: string
) {
  const companyName = options.branding?.company_name || 'CloudHalo'

  // Add logo if provided
  if (options.branding?.logo_url) {
    // In production, you'd fetch and add the logo image
    // For now, just add the company name
    doc
      .fontSize(18)
      .fillColor(primaryColor)
      .text(companyName, 50, 50, { align: 'left' })
  } else {
    doc
      .fontSize(18)
      .fillColor(primaryColor)
      .text(companyName, 50, 50, { align: 'left' })
  }

  // Add horizontal line
  doc
    .strokeColor(primaryColor)
    .lineWidth(2)
    .moveTo(50, 80)
    .lineTo(545, 80)
    .stroke()
}

function addSummarySection(
  doc: PDFKit.PDFDocument,
  totalCost: number,
  primaryColor: string
) {
  const boxY = doc.y
  const boxHeight = 80
  const boxWidth = 495

  // Draw background box
  doc.rect(50, boxY, boxWidth, boxHeight).fill('#F8F9FA')

  // Add summary content
  doc
    .fontSize(14)
    .fillColor('#666666')
    .text('Total Cost', 70, boxY + 20)

  doc
    .fontSize(32)
    .fillColor(primaryColor)
    .font('Helvetica-Bold')
    .text(formatCurrency(totalCost), 70, boxY + 40)

  doc.font('Helvetica') // Reset font
}

function addCostBreakdownTable(
  doc: PDFKit.PDFDocument,
  costData: CostData[],
  primaryColor: string,
  lightGray: string,
  borderColor: string
) {
  doc.fontSize(16).fillColor('#333333').font('Helvetica-Bold').text('Cost Breakdown')
  doc.font('Helvetica')

  doc.moveDown(1)

  const tableTop = doc.y
  const tableLeft = 50
  const colWidths = {
    date: 100,
    resource: 180,
    service: 120,
    cost: 95,
  }

  // Table headers
  let currentY = tableTop
  doc
    .fontSize(10)
    .fillColor('#FFFFFF')
    .rect(tableLeft, currentY, 495, 25)
    .fill(primaryColor)

  doc
    .fillColor('#FFFFFF')
    .text('Date', tableLeft + 5, currentY + 7, { width: colWidths.date })
    .text('Resource', tableLeft + colWidths.date + 5, currentY + 7, {
      width: colWidths.resource,
    })
    .text('Service', tableLeft + colWidths.date + colWidths.resource + 5, currentY + 7, {
      width: colWidths.service,
    })
    .text(
      'Cost (USD)',
      tableLeft + colWidths.date + colWidths.resource + colWidths.service + 5,
      currentY + 7,
      { width: colWidths.cost, align: 'right' }
    )

  currentY += 25

  // Sort by date descending
  const sortedData = [...costData].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Limit to recent entries to avoid overly long reports
  const maxRows = 50
  const displayData = sortedData.slice(0, maxRows)

  // Table rows
  displayData.forEach((row, index) => {
    const bgColor = index % 2 === 0 ? '#FFFFFF' : lightGray
    doc.rect(tableLeft, currentY, 495, 20).fill(bgColor)

    doc
      .fontSize(9)
      .fillColor('#333333')
      .text(formatDate(row.date), tableLeft + 5, currentY + 5, {
        width: colWidths.date,
      })
      .text(row.resource_name || 'N/A', tableLeft + colWidths.date + 5, currentY + 5, {
        width: colWidths.resource,
        ellipsis: true,
      })
      .text(
        row.service_category || 'N/A',
        tableLeft + colWidths.date + colWidths.resource + 5,
        currentY + 5,
        { width: colWidths.service, ellipsis: true }
      )
      .text(
        formatCurrency(row.cost_usd),
        tableLeft + colWidths.date + colWidths.resource + colWidths.service + 5,
        currentY + 5,
        { width: colWidths.cost, align: 'right' }
      )

    currentY += 20

    // Add new page if needed
    if (currentY > 720 && index < displayData.length - 1) {
      doc.addPage()
      currentY = 50
    }
  })

  if (sortedData.length > maxRows) {
    doc.moveDown(1)
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(
        `Showing ${maxRows} of ${sortedData.length} entries. Full data available in export.`,
        { align: 'center' }
      )
  }
}

function addCategoryBreakdown(
  doc: PDFKit.PDFDocument,
  categoryData: { category: string; total: number }[],
  primaryColor: string,
  lightGray: string,
  borderColor: string
) {
  doc.fontSize(16).fillColor('#333333').font('Helvetica-Bold').text('Cost by Service Category')
  doc.font('Helvetica')

  doc.moveDown(1)

  const tableTop = doc.y
  const tableLeft = 50

  // Table header
  let currentY = tableTop
  doc.fontSize(10).fillColor('#FFFFFF').rect(tableLeft, currentY, 495, 25).fill(primaryColor)

  doc
    .fillColor('#FFFFFF')
    .text('Service Category', tableLeft + 5, currentY + 7, { width: 300 })
    .text('Total Cost (USD)', tableLeft + 310, currentY + 7, {
      width: 180,
      align: 'right',
    })

  currentY += 25

  // Sort by cost descending
  const sortedCategories = [...categoryData].sort((a, b) => b.total - a.total)

  sortedCategories.forEach((row, index) => {
    const bgColor = index % 2 === 0 ? '#FFFFFF' : lightGray
    doc.rect(tableLeft, currentY, 495, 20).fill(bgColor)

    doc
      .fontSize(9)
      .fillColor('#333333')
      .text(row.category, tableLeft + 5, currentY + 5, { width: 300 })
      .text(formatCurrency(row.total), tableLeft + 310, currentY + 5, {
        width: 180,
        align: 'right',
      })

    currentY += 20

    if (currentY > 720 && index < sortedCategories.length - 1) {
      doc.addPage()
      currentY = 50
    }
  })
}

function addFooter(
  doc: PDFKit.PDFDocument,
  options: ReportOptions,
  textColor: string
) {
  const pageCount = doc.bufferedPageRange().count

  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)

    const generatedText = `Generated on ${formatDateTime(options.generatedAt || new Date())}`
    const generatedBy = options.generatedBy
      ? ` by ${options.generatedBy}`
      : ' by CloudHalo'

    doc
      .fontSize(8)
      .fillColor('#999999')
      .text(generatedText + generatedBy, 50, 770, {
        align: 'left',
        width: 495,
      })

    doc.text(`Page ${i + 1} of ${pageCount}`, 50, 770, {
      align: 'right',
      width: 495,
    })
  }
}

// Utility functions
function aggregateByCategory(costData: CostData[]): { category: string; total: number }[] {
  const categoryMap = new Map<string, number>()

  costData.forEach((row) => {
    const category = row.service_category || 'Uncategorized'
    const current = categoryMap.get(category) || 0
    categoryMap.set(category, current + row.cost_usd)
  })

  return Array.from(categoryMap.entries()).map(([category, total]) => ({
    category,
    total,
  }))
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

/**
 * Convert PDF buffer to a readable stream
 */
export function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable()
  readable.push(buffer)
  readable.push(null)
  return readable
}
