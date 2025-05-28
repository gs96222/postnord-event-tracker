import { ShipmentStatus } from './shipment';

export type CreateEventRequest = {
  timestamp: string;
  status: ShipmentStatus;
  location?: string;
  details?: string;
};

export type ShipmentEventParams = {
  shipmentId: string;
};

export type GetEventsQuery = {
  limit: number;
  startKey?: string;
};

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  timestamp: string;
  status: ShipmentStatus;
  location?: string;
  details?: string;
  createdAt: string;
}
