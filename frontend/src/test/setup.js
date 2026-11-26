import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom chưa có showModal/close của <dialog>; các hộp thoại (đối soát, xác nhận) gọi hai hàm này khi mở.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true }
  HTMLDialogElement.prototype.close = function close() { this.open = false }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
