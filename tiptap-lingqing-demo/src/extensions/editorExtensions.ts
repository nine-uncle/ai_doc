import { Color } from '@tiptap/extension-color'
import Heading from '@tiptap/extension-heading'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Paragraph from '@tiptap/extension-paragraph'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { mergeAttributes } from '@tiptap/core'
import type { Extensions } from '@tiptap/core'
import { AnnotationMark } from '@/extensions/AnnotationMark'
import {
  buildDocxBlockStyle,
  buildDocxTableCellStyle,
  buildDocxTextStyle,
  docxBlockAttributeDefs,
} from '@/utils/docxStyleRender'

const DocxTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: { default: null },
      fontFamily: { default: null },
      backgroundColor: { default: null },
      color: { default: null },
      letterSpacing: { default: null },
      rtl: { default: null },
    }
  },
  renderHTML({ mark, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, buildDocxTextStyle(mark.attrs)),
      0,
    ]
  },
})

const DocxParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...docxBlockAttributeDefs(),
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, buildDocxBlockStyle(node.attrs)), 0]
  },
})

export const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...docxBlockAttributeDefs(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {}
          return { id: attributes.id }
        },
      },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level as number
    return [
      `h${level}`,
      mergeAttributes(HTMLAttributes, buildDocxBlockStyle(node.attrs)),
      0,
    ]
  },
})

const DocxTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: { default: null },
      verticalAlign: { default: null },
      noWrap: { default: null },
      textDirection: { default: null },
      borderTop: { default: null },
      borderBottom: { default: null },
      borderLeft: { default: null },
      borderRight: { default: null },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes, buildDocxTableCellStyle(node.attrs)), 0]
  },
})

const DocxTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: { default: null },
      verticalAlign: { default: null },
      noWrap: { default: null },
      textDirection: { default: null },
      borderTop: { default: null },
      borderBottom: { default: null },
      borderLeft: { default: null },
      borderRight: { default: null },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes, buildDocxTableCellStyle(node.attrs)), 0]
  },
})

const DocxTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      marginTop: { default: null },
      marginBottom: { default: null },
      marginLeft: { default: null },
      marginRight: { default: null },
      alignment: { default: null },
      cellSpacing: { default: null },
      layout: { default: null },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const styles: string[] = []
    const { marginTop, marginBottom, marginLeft, marginRight, alignment, cellSpacing } = node.attrs

    if (marginTop) styles.push(`margin-top: ${marginTop}px`)
    if (marginBottom) styles.push(`margin-bottom: ${marginBottom}px`)
    if (marginLeft) styles.push(`margin-left: ${marginLeft}px`)
    if (marginRight) styles.push(`margin-right: ${marginRight}px`)
    if (alignment === 'center') styles.push('margin-left: auto', 'margin-right: auto')
    if (alignment === 'right') styles.push('margin-left: auto')
    if (cellSpacing) styles.push(`border-spacing: ${cellSpacing}px`)

    const tableStyle = styles.length ? { style: styles.join('; ') } : {}

    return [
      'table',
      mergeAttributes(HTMLAttributes, tableStyle, { class: 'docx-table' }),
      ['tbody', 0],
    ]
  },
})

export function createDocxEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      paragraph: false,
    }),
    DocxParagraph,
    CustomHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    DocxTextStyle,
    Color,
    Underline,
    Highlight,
    Subscript,
    Superscript,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Link.configure({ openOnClick: false }),
    Image.configure({ inline: true }),
    DocxTable.configure({ resizable: false }),
    TableRow,
    DocxTableCell,
    DocxTableHeader,
    AnnotationMark,
  ]
}
