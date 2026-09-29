import { Mark, mergeAttributes } from '@tiptap/core'

export const AnnotationMark = Mark.create({
  name: 'annotation',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-annotation-id'),
        renderHTML: (attributes: { id?: string | null }) => {
          if (!attributes.id) return {}
          return { 'data-annotation-id': attributes.id }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-annotation-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'doc-annotation',
      }),
      0,
    ]
  },
})
