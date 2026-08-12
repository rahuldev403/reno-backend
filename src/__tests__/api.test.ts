import request from "supertest";
import app from "..";
import { supabase, supabaseAdmin } from "../config/supabase";

// Mock variables to hold test state
let sellerAToken: string;
let sellerBToken: string;
let customerToken: string;
let targetProductId: string;

// Helper function to create users and get their JWTs
// Helper function to create users and get their JWTs
async function setupTestUser(email: string, role: "SELLER" | "CUSTOMER") {
  const password = "TestPassword123!";

  // 1. AGGRESSIVE CLEANUP: Find and delete the user if they are stuck from a previous failed test
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
  if (usersData?.users) {
    const existingUser = usersData.users.find((u) => u.email === email);
    if (existingUser) {
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
    }
  }

  // 2. Create the user cleanly via Admin API
  const { data: adminData, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: "Test User" },
    });

  if (createError) {
    throw new Error(`Create User Error for ${email}: ${createError.message}`);
  }

  // 3. Sign in with the standard client to get the session token
  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError || !authData.session) {
    throw new Error(`Failed to sign in test user: ${signInError?.message}`);
  }

  const user = authData.user;

  // 4. Force update their role in the profiles table
  await supabaseAdmin.from("profiles").update({ role }).eq("id", user.id);

  return { token: authData.session.access_token, userId: user.id };
}

beforeAll(async () => {
  // 1. Setup Seller A
  const sellerA = await setupTestUser("sellera@test5.com", "SELLER");
  sellerAToken = sellerA.token;

  // 2. Setup Seller B
  const sellerB = await setupTestUser("sellerb@test5.com", "SELLER");
  sellerBToken = sellerB.token;

  // 3. Setup Customer
  const customer = await setupTestUser("customer@test5.com", "CUSTOMER");
  customerToken = customer.token;

  const { data: existingStore } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("seller_id", sellerA.userId)
    .maybeSingle();

  if (!existingStore) {
    await supabaseAdmin.from("stores").insert({
      seller_id: sellerA.userId,
      name: "Seller A Store",
    });
  }
});

describe("Reneo API Core Integration Tests", () => {
  // Scenario 1: Seller A creates a product -> Success
  it("1. Seller A successfully creates a product", async () => {
    const res = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${sellerAToken}`)
      .send({
        title: "Test Product",
        description: "A great product",
        category: "Electronics",
        price_amount: 1000, // 1000 FCFA
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    targetProductId = res.body.data.id;

    // Setup stock for the concurrency test later
    await supabaseAdmin
      .from("inventory")
      .update({ quantity: 1 }) // Only 1 in stock for test 5
      .eq("product_id", targetProductId);
  });

  // Scenario 2: Seller B attempts to modify it -> Denied
  it("2. Seller B is denied when attempting to modify Seller A product", async () => {
    const res = await request(app)
      .patch(`/products/${targetProductId}`)
      .set("Authorization", `Bearer ${sellerBToken}`)
      .send({ title: "Hacked Title" });

    // RLS should block this entirely, resulting in a 404 (Not Found/Unauthorized)
    expect(res.status).toBe(404);
  });

  // Scenario 3: Customer orders an available product -> Success
  it("3. Customer successfully orders an available product", async () => {
    // Add temporary stock just for this test
    await supabaseAdmin
      .from("inventory")
      .update({ quantity: 5 })
      .eq("product_id", targetProductId);

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("x-idempotency-key", `test-3-${Date.now()}`)
      .send({
        items: [{ product_id: targetProductId, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("success");
  });

  // Scenario 4: Customer orders more than the stock -> Denied[cite: 2]
  it("4. Customer is denied when ordering more than available stock", async () => {
    // Reset stock to 1
    await supabaseAdmin
      .from("inventory")
      .update({ quantity: 1 })
      .eq("product_id", targetProductId);

    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("x-idempotency-key", `test-4-${Date.now()}`)
      .send({
        items: [{ product_id: targetProductId, quantity: 2 }], // Requesting 2, only 1 available
      });

    // Must return a 409 Conflict as per standard error shape[cite: 2]
    expect(res.status).toBe(409);
  });

  // Scenario 5: Two simultaneous orders for the last item -> Exactly one succeeds
  it("5. Handles concurrent orders for the last item properly (Racing)", async () => {
    // Create two unique keys so the database treats them as separate orders
    const key1 = `race-key-1-${Date.now()}`;
    const key2 = `race-key-2-${Date.now()}`;

    const req1 = request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("x-idempotency-key", key1) // Use Key 1
      .send({
        items: [{ product_id: targetProductId, quantity: 1 }],
      });

    const req2 = request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("x-idempotency-key", key2) // Use Key 2
      .send({
        items: [{ product_id: targetProductId, quantity: 1 }],
      });

    // Fire them at the exact same time
    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status];

    // One must succeed (201), the other must fail with conflict (409)
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
  });
});
