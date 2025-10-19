import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables for tests
config({ path: resolve(process.cwd(), '.env.local'), override: true });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  // Keep error for debugging
  error: console.error,
};
