export function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}
