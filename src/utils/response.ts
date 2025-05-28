import { APIGatewayProxyResult } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { APIResponse, PaginatedResponse } from '../models';

export const createResponse = <T>(
  statusCode: number,
  body: APIResponse<T> | PaginatedResponse<T>
): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  },
  body: JSON.stringify(body),
});

export const successResponse = <T>(
  data: T,
  message?: string,
  statusCode: number = StatusCodes.OK
): APIGatewayProxyResult =>
  createResponse(statusCode, {
    success: true,
    data,
    ...(message && { message }),
  });

export const paginatedResponse = <T>(
  data: T,
  hasMore: boolean,
  nextKey?: string,
  message?: string,
  statusCode: number = StatusCodes.OK
): APIGatewayProxyResult =>
  createResponse(statusCode, {
    success: true,
    data,
    pagination: {
      hasMore,
      ...(nextKey && { nextKey }),
    },
    ...(message && { message }),
  });

export const errorResponse = (
  error: string,
  statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR
): APIGatewayProxyResult =>
  createResponse(statusCode, {
    success: false,
    error,
  });

export const validationErrorResponse = (errors: string[]): APIGatewayProxyResult =>
  createResponse(StatusCodes.BAD_REQUEST, {
    success: false,
    error: 'Validation failed',
    message: errors.join(', '),
  });

export const parseJSON = <T>(jsonString: string): T | null => {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
};

export const isValidISODate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString();
};
