import '@testing-library/jest-dom'

// Setup global test environment
global.crypto = {
  randomUUID: () => 'test-uuid-123'
}

// Mock fetch globally
global.fetch = jest.fn()

// Silence console warnings in tests
const originalConsoleWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (args[0]?.includes('Warning: ReactDOM.render is no longer supported')) {
      return
    }
    originalConsoleWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalConsoleWarn
}) 