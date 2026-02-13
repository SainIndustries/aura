import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    const result = cn('base-class', 'additional-class')
    expect(result).toBe('base-class additional-class')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const result = cn('base', isActive && 'active')
    expect(result).toBe('base active')
  })

  it('should handle false conditionals', () => {
    const isActive = false
    const result = cn('base', isActive && 'active')
    expect(result).toBe('base')
  })

  it('should handle undefined values', () => {
    const result = cn('base', undefined, 'other')
    expect(result).toBe('base other')
  })

  it('should handle tailwind conflicts', () => {
    // tailwind-merge should resolve conflicting classes
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })

  it('should handle empty inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle array inputs', () => {
    const result = cn(['class1', 'class2'])
    expect(result).toBe('class1 class2')
  })

  it('should handle object inputs', () => {
    const result = cn({
      'visible': true,
      'hidden': false,
      'bg-red-500': true,
    })
    expect(result).toBe('visible bg-red-500')
  })
})
