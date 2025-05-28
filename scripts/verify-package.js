#!/usr/bin/env node

/**
 * Pre-publish verification script for flux-replicate-mcp
 * Ensures the package is ready for publication
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (message, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

const success = (message) => log(`✅ ${message}`, colors.green);
const error = (message) => log(`❌ ${message}`, colors.red);
const warning = (message) => log(`⚠️  ${message}`, colors.yellow);
const info = (message) => log(`ℹ️  ${message}`, colors.blue);

/**
 * Check if required files exist
 */
const checkRequiredFiles = async () => {
  info('Checking required files...');
  
  const requiredFiles = [
    'package.json',
    'README.md',
    'LICENSE',
    '.env.example',
    'INSTALLATION.md',
    'dist/index.js'
  ];

  for (const file of requiredFiles) {
    try {
      await access(join(projectRoot, file));
      success(`Found ${file}`);
    } catch {
      error(`Missing required file: ${file}`);
      process.exit(1);
    }
  }
};

/**
 * Validate package.json
 */
const validatePackageJson = async () => {
  info('Validating package.json...');
  
  const packagePath = join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  
  // Check required fields
  const requiredFields = ['name', 'version', 'description', 'main', 'bin', 'author', 'license'];
  for (const field of requiredFields) {
    if (!packageJson[field]) {
      error(`Missing required field in package.json: ${field}`);
      process.exit(1);
    }
  }
  
  // Check bin configuration
  if (!packageJson.bin['flux-replicate-mcp'] || !packageJson.bin['flux-replicate-mcp-server']) {
    error('Missing binary configurations in package.json');
    process.exit(1);
  }
  
  success('package.json validation passed');
  return packageJson;
};

/**
 * Check for API key leaks in code
 */
const checkForApiKeyLeaks = async () => {
  info('Scanning for potential API key leaks...');
  
  try {
    // Check for hardcoded API keys or tokens (excluding examples)
    const { stdout } = await execAsync('grep -r -i "r8_[a-zA-Z0-9]" src/ || true', { cwd: projectRoot });
    
    // Filter out example tokens
    const lines = stdout.split('\n').filter(line => 
      line.trim() && 
      !line.includes('r8_your_token_here') && 
      !line.includes('example') &&
      !line.includes('CLI:') &&
      !line.includes('ENV:') &&
      !line.includes('console.error')
    );
    
    if (lines.length > 0) {
      error('Found potential hardcoded API keys in source code!');
      console.log(lines.join('\n'));
      process.exit(1);
    }
    
    // Check for logging of sensitive data (excluding help text)
    const { stdout: logCheck } = await execAsync('grep -r "log.*replicateApiKey\\|console.*replicateApiKey" src/ || true', { cwd: projectRoot });
    if (logCheck.trim()) {
      error('Found logging of API keys in source code!');
      console.log(logCheck);
      process.exit(1);
    }
    
    success('No API key leaks detected');
  } catch (err) {
    warning('Could not complete API key leak check');
  }
};

/**
 * Build the project
 */
const buildProject = async () => {
  info('Building project...');
  
  try {
    await execAsync('npm run build', { cwd: projectRoot });
    success('Build completed successfully');
  } catch (err) {
    error('Build failed');
    console.error(err.stdout || err.message);
    process.exit(1);
  }
};

/**
 * Check built file
 */
const validateBuiltFile = async () => {
  info('Validating built file...');
  
  const distPath = join(projectRoot, 'dist/index.js');
  
  try {
    const stats = await stat(distPath);
    if (stats.size < 1000) {
      error('Built file seems too small - build may have failed');
      process.exit(1);
    }
    
    const content = await readFile(distPath, 'utf8');
    
    // Check for shebang
    if (!content.startsWith('#!/usr/bin/env node')) {
      error('Built file missing shebang line');
      process.exit(1);
    }
    
    // Check for potential API key leaks in built file
    if (content.includes('r8_') && !content.includes('r8_your_token_here')) {
      error('Built file may contain hardcoded API keys!');
      process.exit(1);
    }
    
    success(`Built file validated (${Math.round(stats.size / 1024)}KB)`);
  } catch (err) {
    error(`Failed to validate built file: ${err.message}`);
    process.exit(1);
  }
};

/**
 * Test basic functionality
 */
const testBasicFunctionality = async () => {
  info('Testing basic functionality...');
  
  return new Promise((resolve, reject) => {
    // Test help command
    const child = spawn('node', ['dist/index.js', '--help'], { 
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0 && stdout.includes('Flux Replicate MCP Server')) {
        success('Help command works correctly');
        resolve();
      } else {
        error('Help command failed');
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
        reject(new Error('Help command test failed'));
      }
    });
    
    child.on('error', (err) => {
      error(`Failed to run help command: ${err.message}`);
      reject(err);
    });
  });
};

/**
 * Test MCP protocol compliance
 */
const testMcpProtocol = async () => {
  info('Testing MCP protocol compliance...');
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/index.js', '--api-key', 'test'], { 
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Send tools/list request
    const toolsListRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    }) + '\n';
    
    child.stdin.write(toolsListRequest);
    
    setTimeout(() => {
      child.kill();
      
      if (stdout.includes('generate_image') && stdout.includes('jsonrpc')) {
        success('MCP protocol compliance test passed');
        resolve();
      } else {
        error('MCP protocol compliance test failed');
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
        reject(new Error('MCP protocol test failed'));
      }
    }, 2000);
    
    child.on('error', (err) => {
      error(`Failed to run MCP protocol test: ${err.message}`);
      reject(err);
    });
  });
};

/**
 * Run npm pack dry run
 */
const testNpmPack = async () => {
  info('Testing npm pack (dry run)...');
  
  try {
    const { stdout, stderr } = await execAsync('npm pack --dry-run', { cwd: projectRoot });
    
    // npm pack outputs to stderr, not stdout
    const output = stderr || stdout;
    
    // Check that the pack command succeeded and shows expected structure
    if (!output.includes('Tarball Contents') || !output.includes('package size:')) {
      error('npm pack output format unexpected');
      console.log('Output:', output);
      process.exit(1);
    }
    
    // Check for main binary file
    if (!output.includes('index.js')) {
      error('Main binary file not found in package');
      process.exit(1);
    }
    
    success('npm pack dry run passed');
    
    // Show package size info
    const sizeMatch = output.match(/package size:\s+([^\n]+)/);
    const unpackedMatch = output.match(/unpacked size:\s+([^\n]+)/);
    if (sizeMatch && unpackedMatch) {
      info(`Package size: ${sizeMatch[1]}, Unpacked: ${unpackedMatch[1]}`);
    }
    
  } catch (err) {
    error('npm pack dry run failed');
    console.error(err.stdout || err.message);
    process.exit(1);
  }
};

/**
 * Main verification function
 */
const main = async () => {
  log(`${colors.bold}🔍 Pre-publish verification for flux-replicate-mcp${colors.reset}\n`);
  
  try {
    await checkRequiredFiles();
    await validatePackageJson();
    await checkForApiKeyLeaks();
    await buildProject();
    await validateBuiltFile();
    await testBasicFunctionality();
    await testMcpProtocol();
    await testNpmPack();
    
    log(`\n${colors.bold}${colors.green}🎉 All verification checks passed! Package is ready for publication.${colors.reset}`);
    
  } catch (err) {
    log(`\n${colors.bold}${colors.red}💥 Verification failed: ${err.message}${colors.reset}`);
    process.exit(1);
  }
};

// Run verification
main().catch((err) => {
  error(`Verification script crashed: ${err.message}`);
  process.exit(1);
}); 