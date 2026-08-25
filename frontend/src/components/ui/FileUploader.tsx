import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Button } from './Button'

interface FileUploaderProps {
  accept?: string
  maxSizeMB?: number
  onFileSelect: (file: File | null) => void
  currentFile?: File | null
  label?: string
  helpText?: string
}

const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf',
  '.doc',
  '.docx',
]

export function FileUploader({
  accept = DEFAULT_ACCEPTED_TYPES.join(','),
  maxSizeMB = 5,
  onFileSelect,
  currentFile,
  label = 'Resume',
  helpText,
}: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    if (accept) {
      const allowedList = accept.split(',').map((t) => t.trim().toLowerCase())
      const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`
      const fileMime = (file.type || '').toLowerCase()

      const isAllowed = allowedList.some((allowedType) => {
        if (allowedType.startsWith('.')) {
          return fileExt === allowedType
        }
        if (allowedType.endsWith('/*')) {
          const prefix = allowedType.slice(0, -1)
          return fileMime.startsWith(prefix)
        }
        return fileMime === allowedType
      })

      if (!isAllowed) {
        setError(`Invalid file type. Allowed: ${helpText || accept}`)
        return false
      }
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeMB}MB`)
      return false
    }
    setError(null)
    return true
  }

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      onFileSelect(file)
    }
  }

  const handleDrag = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const removeFile = () => {
    onFileSelect(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return (
        <img
          src={URL.createObjectURL(file)}
          alt="Preview"
          className="w-12 h-12 object-cover rounded-md border border-gray-200"
        />
      )
    }
    if (file.type.includes('pdf')) {
      return (
        <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 6.5c0 .83-.67 1.5-1.5 1.5S9 9.33 9 8.5 9.67 7 10.5 7s1.5.67 1.5 1.5v3H14V8.5zM18 20H6V4h7v5h5v11z" />
        </svg>
      )
    }
    return (
      <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 6.5c0 .83-.67 1.5-1.5 1.5S9 9.33 9 8.5 9.67 7 10.5 7s1.5.67 1.5 1.5v3H14V8.5zM18 20H6V4h7v5h5v11z" />
      </svg>
    )
  }

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-xl p-6 transition-colors ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          id={`${label.toLowerCase()}-upload`}
          onChange={handleChange}
          disabled={!!currentFile}
        />
        {currentFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">{getFileIcon(currentFile)}</div>
              <div>
                <p className="font-medium text-gray-900">{currentFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(currentFile.size)}</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={removeFile} className="text-red-600 hover:text-red-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-indigo-600 underline cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                Click to upload
              </span>
              {' or drag and drop'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {helpText || `PDF, DOC, DOCX up to ${maxSizeMB}MB`}
            </p>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  )
}