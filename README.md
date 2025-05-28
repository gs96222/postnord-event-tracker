# PostNord Event Tracker

A serverless application for tracking shipment events using AWS Lambda, API Gateway, and DynamoDB.

## 🏗️ Architecture & Design

### System Architecture

This solution implements a serverless event-driven architecture with the following components:

- **API Gateway**: RESTful API endpoints with CORS support and request validation
- **AWS Lambda**: Serverless compute for business logic (Node.js 18.x)
- **DynamoDB**: NoSQL database for event storage with composite keys
- **Infrastructure as Code**: AWS CDK for cloud deployment, SAM for local development

### Key Design Decisions

1. **Serverless Architecture**: Chosen for automatic scaling, cost-effectiveness, and operational simplicity
2. **Event Sourcing Pattern**: All shipment events are immutable records with timestamps
3. **DynamoDB Composite Keys**: `shipmentId` (partition key) + `id` (sort key) for efficient queries
4. **TypeScript**: Ensures type safety and better developer experience
5. **Validation Layer**: Comprehensive input validation using Zod schemas

### Assumptions

- Shipment IDs follow specific formats (UPU standard or generic)
- Events are ordered by timestamp
- No authentication required for API endpoints
- Single region deployment
- Eventual consistency is acceptable for DynamoDB

### Request/Response Design

**Request Body Structure:**

```json
{
  "timestamp": "2025-05-20T10:30:00Z",
  "status": "in_transit",
  "location": "Stockholm Distribution Center",
  "details": "Package sorted and ready for transport"
}
```

**Why This Structure:**

- **ISO 8601 Timestamps**: International standard, timezone-aware, parseable
- **Simple Field Names**: Clear, intuitive naming without unnecessary nesting
- **Optional Fields**: `location` and `details` provide flexibility without complexity
- **Status as String**: Easy to validate and extend with new statuses

**Response Structure Enhancement:**
All endpoints follow a consistent wrapper pattern:

```json
{
  "success": boolean,
  "data": {...},
  "error": string,
  "message": string,
  "pagination": {...}
}
```

**Benefits:**

- **Consistent Pattern**: All endpoints follow same response format
- **Success Indicator**: Frontend can easily determine success/failure
- **Structured Error Handling**: Clear error messages without exposing internals
- **Pagination Support**: Built-in pagination for scalable event history
- **Extensibility**: Easy to add new fields without breaking changes

## 📋 Setup Requirements

### System Requirements

- Node.js 18.x or higher
- npm 8.x or higher
- AWS CLI configured with appropriate credentials
- AWS SAM CLI (for local development)
- Docker (for local DynamoDB)

### AWS Configuration

Configure your AWS credentials using one of these methods:

```bash
# Method 1: AWS CLI configuration
aws configure

# Method 2: Environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1

# Verify configuration
aws sts get-caller-identity
```

## 🚀 Quick Start

### 1. Installation

```bash
git clone git@github.com:gs96222/postnord-event-tracker.git
cd postnord-event-tracker
npm install

# Install CDK dependencies
cd cdk && npm install && cd ..
```

### 2. Local Development

#### Option 1: Quick Setup (Recommended)

```bash
# This runs build + DynamoDB + API in sequence
npm run dev
```

#### Option 2: Step-by-Step Setup

**Terminal 1 - Start DynamoDB:**

```bash
npm run db:start  # Runs on port 8000, keep terminal open
```

**Terminal 2 - Setup and Start API:**

```bash
# Create database tables
npm run db:create

# Add sample data (optional)
npm run db:seed

# Build application
npm run build

# Build SAM application
npm run sam:build

# Start API Gateway
npm run sam:start  # API available at http://localhost:3000
```

**Test the Setup:**

```bash
# Test API health
curl http://localhost:3000/

# Test with sample request
curl -X POST http://localhost:3000/shipments/TEST123456789/events \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2025-05-20T10:30:00Z",
    "status": "in_transit",
    "location": "Stockholm",
    "details": "Package processed"
  }'
```

### 3. Cloud Deployment

```bash
cd cdk

# Bootstrap CDK (first time only)
npm run bootstrap

# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod

# View deployment differences
npm run diff:dev
```

## 📚 API Reference

### Base URLs

- **Local Development**: `http://localhost:3000`
- **Production**: `https://<api-id>.execute-api.<region>.amazonaws.com/prod/`

### Endpoints

#### 1. Record Event

```http
POST /shipments/{shipmentId}/events
```

**Request Body:**

```json
{
  "timestamp": "2025-05-20T10:30:00Z",
  "status": "in_transit",
  "location": "Stockholm Distribution Center",
  "details": "Package sorted and ready for transport"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "shipmentId": "SHIP-123456",
    "timestamp": "2025-05-20T10:30:00Z",
    "status": "in_transit",
    "location": "Stockholm Distribution Center",
    "details": "Package sorted and ready for transport",
    "createdAt": "2025-05-20T10:30:15Z"
  }
}
```

#### 2. Get Latest Event

```http
GET /shipments/{shipmentId}/events/latest
```

#### 3. Get Event History

```http
GET /shipments/{shipmentId}/events?limit=50&startKey=<pagination-key>
```

**Query Parameters:**

- `limit`: Number of events to return (1-100, default: 50)
- `startKey`: Pagination token for next page

**Paginated Response:**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "hasMore": true,
    "nextKey": "encoded-pagination-token"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Validation failed",
  "message": "Shipment ID is required"
}
```

## 🗄️ Database Design

### DynamoDB Table: `shipment-events`

**Primary Key Design:**

- **Partition Key**: `shipmentId` (String) - Distributes events across partitions
- **Sort Key**: `id` (String) - UUID for each event, enables sorting and uniqueness

**Event Structure:**

```json
{
  "id": "uuid", // Added: Unique event identifier
  "shipmentId": "...", // Required: From URL path
  "timestamp": "...", // User provided (ISO 8601)
  "status": "...", // User provided (validated enum)
  "location": "...", // Optional user field
  "details": "...", // Optional user field
  "createdAt": "..." // Added: System timestamp
}
```

**Design Benefits:**

- **Efficient Queries**: Fast lookups by shipment ID
- **Natural Sorting**: Events sorted chronologically by ID
- **Scalable Distribution**: Partition key distributes load evenly
- **Audit Trail**: System timestamps for event recording vs occurrence
- **Immutable Records**: Event sourcing pattern for complete history

**Why DynamoDB:**

- Serverless and fully managed
- Low latency for read/write operations
- Automatic scaling with pay-per-use pricing
- Excellent for time-series data (shipment events)
- Built-in support for sorting by timestamp

## 🔒 Security & Validation

### Input Validation

**Shipment ID Formats (Validated):**

- **UPU Standard**: `XX123456789XX` (Universal Postal Union international format)
- **Alternative Format**: `SHIP-123456` to `SHIP-123456789012`
- **Generic**: Alphanumeric with separators, 5-50 characters

**Valid Statuses:**

- `created`, `picked_up`, `in_transit`, `out_for_delivery`
- `delivered`, `attempted_delivery`, `exception`
- `returned`, `cancelled`, `on_hold`

**Other Validations:**

- **Timestamp**: ISO 8601 format with reasonable time bounds
- **Field Lengths**: Maximum length limits for all string fields (location: 200 chars, details: 500 chars)
- **Required Fields**: Timestamp and status are mandatory

### Security Features

- **Input Sanitization**: All inputs validated and sanitized before processing
- **Error Handling**: User-friendly error messages without exposing internal details
- **AWS Security**: Lambda execution roles with minimal required permissions
- **CORS Configuration**: Proper CORS headers for web application integration

### Future Security Enhancements

- Authentication/authorization (API Keys, Cognito, or IAM-based auth)
- Rate limiting and request throttling
- Input validation middleware
- Request logging and monitoring

## 🧪 Testing & Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# CI testing
npm run test:ci
```

### Development Workflow

1. **Make Code Changes**: Modify source code
2. **Run Tests**: `npm test`
3. **Test Locally**: `npm run dev`
4. **Build**: `npm run build`
5. **Deploy to Dev**: `npm run deploy:dev`
6. **Test in Cloud**: Verify deployment
7. **Deploy to Prod**: `npm run deploy:prod`

### Environment Configuration

The CDK stack supports multiple environments:

- **Development**: `npm run deploy:dev`
- **Staging**: `npm run deploy:staging`
- **Production**: `npm run deploy:prod`

## 🐛 Troubleshooting

### Common Issues & Solutions

#### 🚨 **Port Conflicts**

```bash
# Check if port 8000 is in use
netstat -an | grep 8000
# OR
lsof -i :8000

# Kill process using port 8000
kill -9 $(lsof -t -i:8000)
```

#### 🚨 **AWS Credentials Issues**

```bash
# Verify credentials
aws sts get-caller-identity

# Reconfigure if needed
aws configure

# Check environment variables
echo $AWS_ACCESS_KEY_ID
```

#### 🚨 **Docker Issues**

```bash
# Check if Docker is running
docker info

# Restart Docker daemon
# On Mac: Restart Docker Desktop
# On Linux: sudo systemctl restart docker
```

#### 🚨 **Table Creation Failures**

```bash
# Manual table creation if script fails
aws dynamodb create-table \
  --table-name shipment-events \
  --attribute-definitions \
    AttributeName=shipmentId,AttributeType=S \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=shipmentId,KeyType=HASH \
    AttributeName=id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

#### 🚨 **SAM Build Issues**

```bash
# Clear build cache and rebuild
rm -rf .aws-sam
npm run build
sam build --no-cached

# Check for TypeScript errors
npx tsc --noEmit
```

#### 🚨 **Environment Variable Issues**

Ensure your `env.json` contains:

```json
{
  "Parameters": {
    "SHIPMENT_EVENTS_TABLE": "shipment-events",
    "AWS_REGION": "us-east-1",
    "AWS_ACCESS_KEY_ID": "dummy",
    "AWS_SECRET_ACCESS_KEY": "dummy",
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  }
}
```

### Debug Commands

```bash
# Check AWS credentials
aws sts get-caller-identity

# List local DynamoDB tables
aws dynamodb list-tables --endpoint-url http://localhost:8000

# Check table structure
aws dynamodb describe-table --table-name shipment-events --endpoint-url http://localhost:8000

# Test DynamoDB connection
node scripts/test-dynamodb.js

# Setup local database
node scripts/setup-local-db.js

# Check SAM logs
npm run sam:logs

# View CDK diff before deployment
npm run diff:dev

# Validate SAM template
sam validate

# Check DynamoDB local health
curl http://localhost:8000/
```

## 📁 Project Structure

```
├── src/
│   ├── api/           # Lambda function handlers
│   ├── models/        # TypeScript interfaces and types
│   ├── services/      # Business logic and AWS service clients
│   ├── utils/         # Utility functions
│   └── validators/    # Input validation schemas
├── cdk/               # AWS CDK infrastructure code
├── mocks/             # Test mocks and fixtures
├── scripts/           # Utility scripts (DB setup, testing)
└── tests/             # Unit and integration tests
```
