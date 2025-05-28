// Setup environment variables for tests
import './aws-sdk.mock';

process.env.SHIPMENT_EVENTS_TABLE = 'test-shipment-events';
process.env.AWS_REGION = 'us-east-1';
process.env.NODE_ENV = 'test';

// Mock console methods
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  } as any;
