import { z } from 'zod';
import {
  VALID_SHIPMENT_STATUSES,
  VALIDATION_LIMITS,
  SHIPMENT_ID_PATTERNS
} from '../models';


export const validateShipmentIdFormat = (shipmentId: string): boolean => {
    return SHIPMENT_ID_PATTERNS.some(pattern => pattern.test(shipmentId));
};

export const validateEventTimestamp = (timestamp: string): boolean => {
    const eventTime = new Date(timestamp);
    const now = new Date();
    const maxFutureTime = new Date(now.getTime() + 5 * 60 * 1000);
    const oneYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    return eventTime <= maxFutureTime && eventTime >= oneYear;
  };


export const CreateEventSchema = z.object({
  timestamp: z.string().datetime({ message: 'Timestamp must be in ISO 8601 format' }),
  status: z.enum(VALID_SHIPMENT_STATUSES as [string, ...string[]], {
    errorMap: () => ({
      message: `Status must be one of: ${VALID_SHIPMENT_STATUSES.join(', ')}`
    })
  }),
  location: z.string()
    .max(VALIDATION_LIMITS.LOCATION.MAX_LENGTH,
         `Location must be less than ${VALIDATION_LIMITS.LOCATION.MAX_LENGTH} characters`)
    .optional(),
  details: z.string()
    .max(VALIDATION_LIMITS.DETAILS.MAX_LENGTH,
         `Details must be less than ${VALIDATION_LIMITS.DETAILS.MAX_LENGTH} characters`)
    .optional(),
});

export const ShipmentEventParamsSchema = z.object({
  shipmentId: z.string()
    .min(VALIDATION_LIMITS.SHIPMENT_ID.MIN_LENGTH, 'Shipment ID is required')
    .max(VALIDATION_LIMITS.SHIPMENT_ID.MAX_LENGTH,
         `Shipment ID must be less than ${VALIDATION_LIMITS.SHIPMENT_ID.MAX_LENGTH} characters`)
    .refine(validateShipmentIdFormat, {
      message: 'Shipment ID format is invalid'
    }),
});

export const GetEventsQuerySchema = z.object({
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : VALIDATION_LIMITS.QUERY_LIMIT.DEFAULT)
    .refine(val => val >= VALIDATION_LIMITS.QUERY_LIMIT.MIN && val <= VALIDATION_LIMITS.QUERY_LIMIT.MAX, {
      message: `Limit must be between ${VALIDATION_LIMITS.QUERY_LIMIT.MIN} and ${VALIDATION_LIMITS.QUERY_LIMIT.MAX}`
    }),
  startKey: z.string().optional(),
});