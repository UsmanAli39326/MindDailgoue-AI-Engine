import fs from 'fs';

const BASE_URL = 'http://localhost:8000';
const AUTH_HEADER = {
  'Authorization': 'Bearer dev-user-123'
};

async function testAvatars() {
  console.log("=== Testing Avatar Implementation ===");

  // 1. Test Static Serving of Prebuilt Avatars
  console.log("\n1. Testing static serving of prebuilt avatars...");
  const staticRes = await fetch(`${BASE_URL}/assets/avatars/motivator.png`);
  if (staticRes.ok) {
    console.log("✅ Successfully fetched /assets/avatars/motivator.png");
    console.log(`   Content-Type: ${staticRes.headers.get('content-type')}`);
  } else {
    console.error("❌ Failed to fetch prebuilt avatar. Status:", staticRes.status);
    process.exit(1);
  }

  // 2. Test Custom Bot Creation with Uploaded Avatar
  console.log("\n2. Testing custom bot creation WITH an avatar upload...");
  
  // Create a mock image blob (just 1x1 transparent png for test)
  const mockPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const buffer = Buffer.from(mockPngBase64, 'base64');
  const blob = new Blob([buffer], { type: 'image/png' });

  const formDataWithFile = new FormData();
  formDataWithFile.append('name', 'Test Dr. Upload');
  formDataWithFile.append('traits', JSON.stringify(['Friendly', 'Logical']));
  formDataWithFile.append('avatar', blob, 'test-avatar.png');

  const uploadRes = await fetch(`${BASE_URL}/personalities`, {
    method: 'POST',
    headers: AUTH_HEADER, // No Content-Type header so fetch can set the multipart boundary automatically
    body: formDataWithFile
  });

  const uploadData = await uploadRes.json();
  if (uploadRes.ok && uploadData.avatarAsset && uploadData.avatarAsset.startsWith('data:image/png;base64,')) {
    console.log(`✅ Successfully uploaded avatar! Output avatarAsset begins with: ${uploadData.avatarAsset.substring(0, 35)}...`);
  } else {
    console.error("❌ Failed custom bot upload test.", uploadData);
    process.exit(1);
  }

  // 3. Test Custom Bot Creation WITHOUT an Uploaded Avatar (Fallback)
  console.log("\n3. Testing custom bot creation WITHOUT an avatar (Fallback Check)...");
  
  const formDataWithoutFile = new FormData();
  formDataWithoutFile.append('name', 'Test Dr. Fallback');
  formDataWithoutFile.append('traits', JSON.stringify(['Calm']));

  const fallbackRes = await fetch(`${BASE_URL}/personalities`, {
    method: 'POST',
    headers: AUTH_HEADER,
    body: formDataWithoutFile
  });

  const fallbackData = await fallbackRes.json();
  if (fallbackRes.ok && fallbackData.avatarAsset === '/assets/avatars/dr_fallback.png') {
    console.log("✅ Successfully verified fallback avatar was applied: ", fallbackData.avatarAsset);
  } else {
    console.error("❌ Failed custom bot fallback test.", fallbackData);
    process.exit(1);
  }

  console.log("\n✅ ALL TESTS PASSED!");
}

testAvatars().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
