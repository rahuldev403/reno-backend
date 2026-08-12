import { supabase } from './src/config/supabase';

async function getAllTokens() {
  // 1. Get Seller Token
  const { data: sellerData, error: sellerError } = await supabase.auth.signInWithPassword({
    email: 'sellera@test.com',
    password: 'TestPassword123!',
  });

  if (sellerError) {
    console.error("Seller Error:", sellerError.message);
  } else {
    console.log("\n--- YOUR SELLER TOKEN ---");
    console.log(sellerData.session?.access_token);
  }

  // 2. Get Customer Token
  const { data: customerData, error: customerError } = await supabase.auth.signInWithPassword({
    email: 'customer@test.com',
    password: 'TestPassword123!',
  });

  if (customerError) {
    console.error("\nCustomer Error:", customerError.message);
  } else {
    console.log("\n--- YOUR CUSTOMER TOKEN ---");
    console.log(customerData.session?.access_token, "\n");
  }
}

getAllTokens();