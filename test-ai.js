require('dotenv').config();
const { generateRecommendations } = require('./Backend/src/engine/geminiService');

async function test() {
  console.log("Testing Groq AI generation...");
  try {
    const params = {
      institution_type: "hospital",
      area_size: 5000,
      surface_types: ["tile", "hard_floor"],
      hygiene_standard: "medical_grade",
      budget: "medium"
    };
    
    console.log("Calling generateRecommendations...");
    const result = await generateRecommendations(params);
    console.log("\nRESULT:", JSON.stringify(result, null, 2));
    
    if (result && result.recommendations) {
      console.log(`\n✅ Success! Generated ${result.recommendations.length} recommendations.`);
    } else {
      console.log(`\n❌ Failed! Result was null or invalid.`);
    }
  } catch (err) {
    console.error("Error during test:", err);
  }
}

test();
