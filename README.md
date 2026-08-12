# Reneo Backend API

Backend implementation for the Reneo commerce platform technical assessment.

Built with **Node.js, Express, TypeScript, PostgreSQL, and Supabase**.

The main focus of the implementation is correctness around **authentication, RLS, inventory, concurrent orders, idempotency, and server-side price validation**.

## Tech Stack

* Node.js + Express
* TypeScript
* PostgreSQL / Supabase
* Supabase Auth
* Jest
* REST API

## Setup

### 1. Environment

Create a `.env` file using `.env.example`:

```bash
cp .env.example .env
```

Add the required Supabase URL, Anon Key and Service Role Key.

### 2. Database

Run the migrations from `supabase/migrations/` in this order:

```text
001_initial_schema.sql
002_rls_policies.sql
003_process_order_rpc.sql
```

These create the schema, security policies, indexes and transactional order-processing logic.

### 3. Run

```bash
npm install
npm run dev
```

The API runs on port `3000`.

Run the test suite with:

```bash
npm run test
```

## Key Technical Decisions

### Concurrent Orders

Order processing is handled inside PostgreSQL through the `process_order` RPC.

Inventory rows are locked using:

```sql
SELECT quantity
FROM inventory
WHERE product_id = X
FOR UPDATE;
```

This makes stock deduction atomic. If two customers try to purchase the last item simultaneously, PostgreSQL serializes access to the inventory row. One order succeeds and the other receives an `OUT_OF_STOCK` conflict.

This was the most important correctness requirement in the assessment.

### Server-Side Pricing

The client never provides the price used to create an order.

The backend resolves the product, seller, availability, stock and current price directly from the database. This prevents a modified client request from changing the actual order price.

### Idempotency

`POST /orders` requires an `x-idempotency-key`.

The key is stored with the order and protected by a unique constraint. If the same key is received again, the existing order is returned instead of creating another order.

### Row Level Security

Supabase RLS is used to enforce ownership at the database level.

A seller can only access their own resources, so authorization does not depend only on Express middleware.

### Search & Pagination

`GET /products` supports:

* Text search
* Category
* Price range
* Availability
* Sorting
* Pagination

A PostgreSQL GIN index is used for product text search.

The repository also includes an `EXPLAIN ANALYZE` example for the main search query.

### Events

After an order is successfully created, an `ORDER_CREATED` event is emitted using Node.js `EventEmitter`.

The database transaction is independent of the notification, so a notification failure does not roll back a successful order.

For a larger production system, I would replace this with a durable queue such as RabbitMQ, SQS or BullMQ.

## Testing

The automated tests cover the core scenarios from the assessment, including:

* Seller creates a product
* Another seller cannot modify it
* Customer successfully places an order
* Ordering more than available stock fails
* Two simultaneous orders for the last item result in exactly one successful order

The concurrency test actually sends the requests concurrently rather than sequentially.

## Scaling

For significantly higher traffic, I would evolve the architecture gradually:

```text
Client
  |
CDN / API Gateway
  |
API Services
  |
  +---- Product Read Service ---- Redis / Elasticsearch
  |
  +---- Order Service ----------- PostgreSQL
                                  |
                                  +---- Queue
                                         |
                                      Workers
```

PostgreSQL would remain the source of truth for transactional order and inventory operations, while Redis and Elasticsearch could handle high-volume reads and search.

Read replicas could also be introduced for product/catalog traffic.

I would avoid immediately splitting the system into multiple databases because inventory and orders require strong transactional consistency. Distributed transactions would add significant complexity without being necessary at this stage.

## Known Limitations / Next Improvements

The current implementation is intentionally focused on the assessment requirements.

For a production deployment, I would next add:

* Durable background jobs with retries and dead-letter handling
* Rate limiting on authentication and order endpoints
* More extensive edge-case and E2E tests
* Structured logging and monitoring
* More robust notification delivery

## AI Usage

I used an AI assistant during development for some boilerplate and debugging including  the accurate schema creation ( which made it faster to build ), the Jest integration-test structure, the `ApiError` class, and troubleshooting an RLS-related issue.

One useful thing I learned during the process was the difference between Supabase `.single()` and `.maybeSingle()`. In cases where RLS prevents a row from being returned, `.maybeSingle()` allowed the application to handle the missing result cleanly and return the appropriate `404` response instead of exposing it as an internal server error.

I reviewed and integrated the generated code myself and can explain the implementation and design decisions.

## Project Structure

```text
src/
├── controllers/
├── middleware/
├── routes/
├── services/
├── utils/
└── ...

supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    └── 003_process_order_rpc.sql

tests/
```

## Notes

This implementation was completed in approximately **6 hours**, with the main effort focused on getting the database design, security, transactional order processing and concurrency behavior correct rather than adding unnecessary features.

Lastly i have never used supabase in backend api building , had a lot of fun building it 

Thank you so much for the assignment !
