export interface DocxBorder {
  color?: string
  size?: number
  style?: string
  space?: number
}

export interface DocxShading {
  fill?: string
  color?: string
  type?: string
}

const BORDER_STYLE_MAP: Record<string, string> = {
  single: 'solid',
  thick: 'solid',
  double: 'double',
  dotted: 'dotted',
  dashed: 'dashed',
  dotDash: 'dashed',
  dotDotDash: 'dashed',
  triple: 'double',
  nil: 'none',
  none: 'none',
}

export function borderToCss(border: DocxBorder | null | undefined): string | null {
  if (!border) return null
  const styleKey = border.style ?? 'single'
  if (styleKey === 'nil' || styleKey === 'none') return null

  const width = border.size ? `${Math.max(0.5, border.size / 8)}pt` : '0.75pt'
  const lineStyle = BORDER_STYLE_MAP[styleKey] ?? 'solid'
  const color = border.color && border.color !== 'auto' ? border.color : '#000000'

  return `${width} ${lineStyle} ${color}`
}

export function shadingToBackground(shading: DocxShading | null | undefined): string | null {
  if (!shading?.fill || shading.fill === 'auto') return null
  return shading.fill
}

function pushStyle(styles: string[], property: string, value: string | null | undefined) {
  if (value) styles.push(`${property}: ${value}`)
}

export function buildDocxBlockStyle(attrs: Record<string, unknown>): Record<string, string> {
  const styles: string[] = []

  pushStyle(styles, 'margin-left', attrs.indentLeft as string | undefined)
  pushStyle(styles, 'margin-right', attrs.indentRight as string | undefined)
  pushStyle(styles, 'text-indent', attrs.indentFirstLine as string | undefined)
  pushStyle(styles, 'margin-top', attrs.spacingBefore as string | undefined)
  pushStyle(styles, 'margin-bottom', attrs.spacingAfter as string | undefined)

  if (typeof attrs.indentFirstLineChars === 'number') {
    pushStyle(styles, 'text-indent', `${attrs.indentFirstLineChars / 100}em`)
  }

  const shadingBg = shadingToBackground(attrs.shading as DocxShading | undefined)
  pushStyle(styles, 'background-color', shadingBg ?? undefined)

  pushStyle(styles, 'border-top', borderToCss(attrs.borderTop as DocxBorder | undefined) ?? undefined)
  pushStyle(styles, 'border-bottom', borderToCss(attrs.borderBottom as DocxBorder | undefined) ?? undefined)
  pushStyle(styles, 'border-left', borderToCss(attrs.borderLeft as DocxBorder | undefined) ?? undefined)
  pushStyle(styles, 'border-right', borderToCss(attrs.borderRight as DocxBorder | undefined) ?? undefined)

  if (styles.length === 0) return {}

  return { style: styles.join('; ') }
}

export function buildDocxTextStyle(attrs: Record<string, unknown>): Record<string, string> {
  const styles: string[] = []

  pushStyle(styles, 'font-size', attrs.fontSize as string | undefined)
  pushStyle(styles, 'font-family', attrs.fontFamily as string | undefined)
  pushStyle(styles, 'background-color', attrs.backgroundColor as string | undefined)
  pushStyle(styles, 'color', attrs.color as string | undefined)
  pushStyle(styles, 'letter-spacing', attrs.letterSpacing as string | undefined)

  if (attrs.rtl === true) {
    pushStyle(styles, 'direction', 'rtl')
  }

  if (styles.length === 0) return {}

  return { style: styles.join('; ') }
}

export function buildDocxTableCellStyle(attrs: Record<string, unknown>): Record<string, string> {
  const styles: string[] = []

  pushStyle(styles, 'background-color', attrs.backgroundColor as string | undefined)
  pushStyle(styles, 'vertical-align', attrs.verticalAlign as string | undefined)

  if (attrs.noWrap === true) {
    pushStyle(styles, 'white-space', 'nowrap')
  }

  pushStyle(styles, 'border-top', borderToCss(attrs.borderTop as DocxBorder | undefined) ?? undefined)
  pushStyle(styles, 'border-bottom', borderToCss(attrs.borderBottom as DocxBorder | undefined) ?? undefined)
  pushStyle(styles, 'border-left', borderToCss(attrs.borderLeft as DocxBorder | undefined) ?? undefined)
  pushStyle(styles, 'border-right', borderToCss(attrs.borderRight as DocxBorder | undefined) ?? undefined)

  if (styles.length === 0) return {}

  return { style: styles.join('; ') }
}

export function docxBlockAttributeDefs() {
  return {
    indentLeft: { default: null },
    indentRight: { default: null },
    indentFirstLine: { default: null },
    indentFirstLineChars: { default: null },
    spacingBefore: { default: null },
    spacingAfter: { default: null },
    shading: { default: null },
    borderTop: { default: null },
    borderBottom: { default: null },
    borderLeft: { default: null },
    borderRight: { default: null },
  }
}
