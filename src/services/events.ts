import EventEmitter from "node:events";

class OrderEventEmitter extends EventEmitter {}
export const orderEvents = new OrderEventEmitter();

orderEvents.on("ORDER_CREATED", async (orderData) => {
  try {
    console.log(
      console.log(
        `[EVENT: ORDER_CREATED] Processing notification for Order ID: ${orderData.orderId}`,
      ),
    );
  } catch (error) {
    console.error(`[EVENT: ORDER_CREATED] Failed to notify seller:`, error);
  }
});
