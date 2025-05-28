import { StatusCodes } from 'http-status-codes';
import {
  createResponse,
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  parseJSON,
  isValidISODate,
} from '../../utils/response';

describe('Response Utils', () => {
  describe('createResponse', () => {
    it('should create a response with correct structure', () => {
      const body = { success: true, data: 'test' };
      const result = createResponse(200, body);

      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        },
        body: JSON.stringify(body),
      });
    });

    it('should handle different status codes', () => {
      const testCases = [
        { statusCode: 200, body: { success: true } },
        { statusCode: 400, body: { success: false, error: 'Bad Request' } },
        { statusCode: 500, body: { success: false, error: 'Internal Error' } },
      ];

      testCases.forEach(({ statusCode, body }) => {
        const result = createResponse(statusCode, body);
        expect(result.statusCode).toBe(statusCode);
        expect(result.body).toBe(JSON.stringify(body));
      });
    });

    it('should always include CORS headers', () => {
      const result = createResponse(200, { success: true });

      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      });
    });

    it('should handle complex response bodies', () => {
      const complexBody = {
        success: true,
        data: {
          id: 1,
          items: ['a', 'b', 'c'],
          metadata: { count: 3, hasMore: false },
        },
        message: 'Success',
      };

      const result = createResponse(200, complexBody);
      expect(JSON.parse(result.body)).toEqual(complexBody);
    });
  });

  describe('successResponse', () => {
    it('should create a successful response with data', () => {
      const data = { id: 1, name: 'Test' };
      const result = successResponse(data);

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: true,
        data,
      });
    });

    it('should create a successful response with data and message', () => {
      const data = { id: 1, name: 'Test' };
      const message = 'Operation completed successfully';
      const result = successResponse(data, message);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: true,
        data,
        message,
      });
    });

    it('should use custom status code when provided', () => {
      const data = { id: 1, name: 'Test' };
      const result = successResponse(data, 'Created', StatusCodes.CREATED);

      expect(result.statusCode).toBe(StatusCodes.CREATED);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.message).toBe('Created');
    });

    it('should handle different data types', () => {
      const testCases = [
        { data: 'string data' },
        { data: 123 },
        { data: true },
        { data: null },
        { data: [] },
        { data: {} },
        { data: [{ id: 1 }, { id: 2 }] },
      ];

      testCases.forEach(({ data }) => {
        const result = successResponse(data);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(true);
        expect(body.data).toEqual(data);
      });
    });

    it('should not include message field when message is not provided', () => {
      const data = { test: 'data' };
      const result = successResponse(data);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: true,
        data,
      });
      expect(body).not.toHaveProperty('message');
    });
  });

  describe('paginatedResponse', () => {
    it('should create a paginated response with hasMore true and nextKey', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = paginatedResponse(data, true, 'next-key-123');

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: true,
        data,
        pagination: {
          hasMore: true,
          nextKey: 'next-key-123',
        },
      });
    });

    it('should create a paginated response with hasMore false and no nextKey', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = paginatedResponse(data, false);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: true,
        data,
        pagination: {
          hasMore: false,
        },
      });
      expect(body.pagination).not.toHaveProperty('nextKey');
    });

    it('should include message when provided', () => {
      const data = [{ id: 1 }];
      const message = 'Retrieved 1 item';
      const result = paginatedResponse(data, false, undefined, message);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: true,
        data,
        pagination: {
          hasMore: false,
        },
        message,
      });
    });

    it('should use custom status code when provided', () => {
      const data = [{ id: 1 }];
      const result = paginatedResponse(data, true, 'key', 'Success', StatusCodes.CREATED);

      expect(result.statusCode).toBe(StatusCodes.CREATED);
    });

    it('should handle empty data arrays', () => {
      const data: any[] = [];
      const result = paginatedResponse(data, false);

      const body = JSON.parse(result.body);
      expect(body.data).toEqual([]);
      expect(body.pagination.hasMore).toBe(false);
    });

    it('should not include nextKey when not provided', () => {
      const data = [{ id: 1 }];
      const result = paginatedResponse(data, true);

      const body = JSON.parse(result.body);
      expect(body.pagination).toEqual({
        hasMore: true,
      });
      expect(body.pagination).not.toHaveProperty('nextKey');
    });

    it('should not include message when not provided', () => {
      const data = [{ id: 1 }];
      const result = paginatedResponse(data, false);

      const body = JSON.parse(result.body);
      expect(body).not.toHaveProperty('message');
    });
  });

  describe('errorResponse', () => {
    it('should create an error response with default status code', () => {
      const error = 'Something went wrong';
      const result = errorResponse(error);

      expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: false,
        error,
      });
    });

    it('should create an error response with custom status code', () => {
      const error = 'Bad request';
      const result = errorResponse(error, StatusCodes.BAD_REQUEST);

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: false,
        error,
      });
    });

    it('should handle different error messages', () => {
      const errorMessages = [
        'Not found',
        'Unauthorized',
        'Validation failed',
        'Internal server error',
        '',
      ];

      errorMessages.forEach(error => {
        const result = errorResponse(error, StatusCodes.BAD_REQUEST);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.error).toBe(error);
      });
    });

    it('should handle different HTTP status codes', () => {
      const statusCodes = [
        StatusCodes.BAD_REQUEST,
        StatusCodes.UNAUTHORIZED,
        StatusCodes.FORBIDDEN,
        StatusCodes.NOT_FOUND,
        StatusCodes.CONFLICT,
        StatusCodes.INTERNAL_SERVER_ERROR,
      ];

      statusCodes.forEach(statusCode => {
        const result = errorResponse('Test error', statusCode);
        expect(result.statusCode).toBe(statusCode);
      });
    });
  });

  describe('validationErrorResponse', () => {
    it('should create a validation error response with single error', () => {
      const errors = ['Field is required'];
      const result = validationErrorResponse(errors);

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: false,
        error: 'Validation failed',
        message: 'Field is required',
      });
    });

    it('should create a validation error response with multiple errors', () => {
      const errors = ['Field is required', 'Email is invalid', 'Password too short'];
      const result = validationErrorResponse(errors);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: false,
        error: 'Validation failed',
        message: 'Field is required, Email is invalid, Password too short',
      });
    });

    it('should handle empty errors array', () => {
      const errors: string[] = [];
      const result = validationErrorResponse(errors);

      const body = JSON.parse(result.body);
      expect(body).toEqual({
        success: false,
        error: 'Validation failed',
        message: '',
      });
    });

    it('should handle errors with special characters', () => {
      const errors = ['Field "name" is required', 'Value must be > 0', 'Invalid format: abc@def'];
      const result = validationErrorResponse(errors);

      const body = JSON.parse(result.body);
      expect(body.message).toBe(
        'Field "name" is required, Value must be > 0, Invalid format: abc@def'
      );
    });
  });

  describe('parseJSON', () => {
    it('should parse valid JSON strings', () => {
      const testCases = [
        { input: '{"key": "value"}', expected: { key: 'value' } },
        { input: '[1, 2, 3]', expected: [1, 2, 3] },
        { input: '"string"', expected: 'string' },
        { input: '123', expected: 123 },
        { input: 'true', expected: true },
        { input: 'null', expected: null },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseJSON(input);
        expect(result).toEqual(expected);
      });
    });

    it('should return null for invalid JSON strings', () => {
      const invalidJsonStrings = [
        '{"key": value}', // missing quotes
        '{key: "value"}', // unquoted key
        '{"key": "value",}', // trailing comma
        '[1, 2, 3,]', // trailing comma
        'undefined',
        'function() {}',
        '{',
        '[',
        '',
      ];

      invalidJsonStrings.forEach(invalidJson => {
        const result = parseJSON(invalidJson);
        expect(result).toBeNull();
      });
    });

    it('should handle complex nested objects', () => {
      const complexObject = {
        id: 1,
        name: 'Test',
        nested: {
          array: [1, 2, { deep: true }],
          boolean: false,
        },
        nullValue: null,
      };

      const jsonString = JSON.stringify(complexObject);
      const result = parseJSON(jsonString);
      expect(result).toEqual(complexObject);
    });

    it('should preserve data types correctly', () => {
      const data = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 'two', true],
        object: { nested: 'value' },
      };

      const result = parseJSON(JSON.stringify(data));
      expect(result).toEqual(data);
      expect(typeof result?.string).toBe('string');
      expect(typeof result?.number).toBe('number');
      expect(typeof result?.boolean).toBe('boolean');
      expect(result?.null).toBeNull();
      expect(Array.isArray(result?.array)).toBe(true);
      expect(typeof result?.object).toBe('object');
    });
  });

  describe('isValidISODate', () => {
    it('should validate correct ISO date strings', () => {
      const validDates = [
        '2025-05-26T10:00:00.000Z',
        '2025-01-01T00:00:00.000Z',
        '2025-12-31T23:59:59.999Z',
      ];

      validDates.forEach(date => {
        expect(isValidISODate(date)).toBe(true);
      });
    });

    it('should reject invalid ISO date strings', () => {
      const invalidDates = [
        '2025-05-26', // missing time
        '2025-05-26 10:00:00', // wrong format (space instead of T)
        '2025-13-01T10:00:00.000Z', // invalid month
        '2025-05-32T10:00:00.000Z', // invalid day
        '2025-05-26T25:00:00.000Z', // invalid hour
        '2025-05-26T10:60:00.000Z', // invalid minute
        '2025-05-26T10:00:60.000Z', // invalid second
        '2025-02-29T10:00:00.000Z', // invalid leap year (2025 is not leap year)
        'invalid-date',
        '',
        '2025-05-26T10:00:00.000', // missing Z
        '2025-05-26T10:00:00.000+00:00', // timezone offset (not UTC)
      ];

      invalidDates.forEach(date => {
        expect(isValidISODate(date)).toBe(false);
      });
    });
  });

  it('should validate that date string matches toISOString output', () => {
    const date = new Date('2025-05-26T10:00:00.000Z');
    const isoString = date.toISOString();

    expect(isValidISODate(isoString)).toBe(true);

    // Slightly modified versions should fail
    expect(isValidISODate(isoString.replace('T', ' '))).toBe(false);
    expect(isValidISODate(isoString.replace('Z', ''))).toBe(false);
  });

  it('should handle current date and time', () => {
    const now = new Date();
    const isoString = now.toISOString();

    expect(isValidISODate(isoString)).toBe(true);
  });

  it('should reject non-string inputs', () => {
    const nonStringInputs = [123, true, null, undefined, {}, [], new Date()];

    nonStringInputs.forEach(input => {
      expect(isValidISODate(input as any)).toBe(false);
    });
  });
});
