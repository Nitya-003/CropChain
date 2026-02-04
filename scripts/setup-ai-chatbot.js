#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupAIChatbot() {
  console.log('🤖 CropChain AI Chatbot Setup\n');
  console.log('This script will help you configure the AI chatbot feature.\n');

  // Check if backend .env exists
  const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');
  const backendEnvExamplePath = path.join(__dirname, '..', 'backend', '.env.example');
  
  if (!fs.existsSync(backendEnvPath)) {
    console.log('📁 Creating backend .env file from example...');
    if (fs.existsSync(backendEnvExamplePath)) {
      fs.copyFileSync(backendEnvExamplePath, backendEnvPath);
      console.log('✅ Backend .env file created');
    } else {
      console.log('❌ Backend .env.example not found');
      process.exit(1);
    }
  }

  // Check if frontend .env exists
  const frontendEnvPath = path.join(__dirname, '..', '.env');
  const frontendEnvExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(frontendEnvPath)) {
    console.log('📁 Creating frontend .env file from example...');
    if (fs.existsSync(frontendEnvExamplePath)) {
      fs.copyFileSync(frontendEnvExamplePath, frontendEnvPath);
      console.log('✅ Frontend .env file created');
    } else {
      console.log('❌ Frontend .env.example not found');
      process.exit(1);
    }
  }

  console.log('\n🔑 OpenAI API Configuration');
  console.log('To enable full AI functionality, you need an OpenAI API key.');
  console.log('You can get one at: https://platform.openai.com/api-keys\n');

  const hasApiKey = await question('Do you have an OpenAI API key? (y/n): ');

  if (hasApiKey.toLowerCase() === 'y' || hasApiKey.toLowerCase() === 'yes') {
    const apiKey = await question('Enter your OpenAI API key: ');
    
    if (apiKey.trim()) {
      // Update backend .env file
      let envContent = fs.readFileSync(backendEnvPath, 'utf8');
      
      if (envContent.includes('OPENAI_API_KEY=')) {
        envContent = envContent.replace(/OPENAI_API_KEY=.*/, `OPENAI_API_KEY=${apiKey.trim()}`);
      } else {
        envContent += `\n# AI Chatbot Configuration\nOPENAI_API_KEY=${apiKey.trim()}\n`;
      }
      
      // Add other AI configuration if not present
      if (!envContent.includes('AI_MODEL=')) {
        envContent += 'AI_MODEL=gpt-4o-mini\n';
      }
      if (!envContent.includes('AI_MAX_TOKENS=')) {
        envContent += 'AI_MAX_TOKENS=500\n';
      }
      if (!envContent.includes('AI_TEMPERATURE=')) {
        envContent += 'AI_TEMPERATURE=0.7\n';
      }
      
      fs.writeFileSync(backendEnvPath, envContent);
      console.log('✅ OpenAI API key configured successfully!');
    } else {
      console.log('⚠️  No API key provided. Chatbot will run in fallback mode.');
    }
  } else {
    console.log('⚠️  No API key configured. Chatbot will run in fallback mode.');
    console.log('   Fallback mode provides basic responses without AI intelligence.');
  }

  console.log('\n📦 Dependencies Check');
  
  // Check if axios is installed in backend
  const backendPackageJsonPath = path.join(__dirname, '..', 'backend', 'package.json');
  if (fs.existsSync(backendPackageJsonPath)) {
    const backendPackageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, 'utf8'));
    if (!backendPackageJson.dependencies.axios) {
      console.log('⚠️  axios not found in backend dependencies');
      console.log('   Run: cd backend && npm install axios');
    } else {
      console.log('✅ Backend dependencies OK');
    }
  }

  // Check if framer-motion is installed in frontend
  const frontendPackageJsonPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(frontendPackageJsonPath)) {
    const frontendPackageJson = JSON.parse(fs.readFileSync(frontendPackageJsonPath, 'utf8'));
    if (!frontendPackageJson.dependencies['framer-motion']) {
      console.log('⚠️  framer-motion not found in frontend dependencies');
      console.log('   Run: npm install framer-motion');
    } else {
      console.log('✅ Frontend dependencies OK');
    }
  }

  console.log('\n🚀 Setup Complete!');
  console.log('\nNext steps:');
  console.log('1. Start the backend server: cd backend && npm run dev');
  console.log('2. Start the frontend server: npm run dev');
  console.log('3. Look for the chat button in the bottom-right corner');
  console.log('\n🧪 Test the setup:');
  console.log('   cd backend && node test-ai-chat.js');
  
  rl.close();
}

// Run setup if called directly
if (require.main === module) {
  setupAIChatbot().catch(console.error);
}

module.exports = { setupAIChatbot };