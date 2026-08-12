Event Notifications (B3)
I implemented an asynchronous EventEmitter in Node.js to handle the ORDER_CREATED event.

If the notification fails: The order is NOT lost, nor is it retried in this current version. The database transaction handles the source of truth, so the order is fully secured first. A failed notification is simply orphaned.

Next Steps for Scale: For production, this native EventEmitter should be replaced by a robust queue system (e.g., Redis + BullMQ) so that failed webhooks or emails are automatically retried rather than dropped.