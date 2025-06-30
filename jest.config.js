/**
 * Jest Testing Framework Configuration
 * 
 * Comprehensive configuration for the Node.js HTTP server testing infrastructure.
 * Enforces 100% coverage requirements across all metrics and configures 
 * professional-grade testing capabilities per Blitzy platform standards.
 * 
 * Coverage Strategy:
 * - Enforces 100% coverage thresholds for lines, functions, branches, and statements
 * - Focuses coverage collection exclusively on server.js application code
 * - Generates multiple report formats for comprehensive analysis and CI/CD integration
 * - Fails builds when coverage requirements are not met
 * 
 * @fileoverview Jest configuration implementing enterprise-grade testing standards
 * @version 1.0.0
 * @requires jest ^29.0.0
 */

module.exports = {
  // Test Environment Configuration
  // Uses Node.js environment for server-side HTTP testing
  testEnvironment: 'node',

  // Test Discovery Patterns
  // Discovers all test files in standard Jest patterns
  testMatch: [
    '**/test/**/*.test.js',
    '**/test/**/*.spec.js',
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],

  // Coverage Collection Configuration
  // Collects coverage data exclusively from server.js per specification requirements
  collectCoverageFrom: [
    'server.js'
  ],

  // Coverage Exclusion Patterns
  // Excludes test files, configuration files, and non-application code from coverage
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/__tests__/',
    '/coverage/',
    'jest.config.js',
    'package.json',
    'package-lock.json',
    '.gitignore',
    'README.md'
  ],

  // Coverage Reporting Configuration
  // Generates multiple report formats for development, CI/CD, and analysis
  coverageReporters: [
    'text',           // Console output for immediate feedback
    'text-summary',   // Concise summary for pipeline logs
    'lcov',          // Industry-standard format for external tooling
    'html',          // Interactive web-based visualization
    'json',          // Machine-readable data for automated analysis
    'json-summary',  // Compact JSON format for dashboard integration
    'cobertura'      // XML format for CI/CD platform compatibility
  ],

  // Coverage Output Directory
  // Centralizes all coverage artifacts for easy access and CI/CD artifact collection
  coverageDirectory: 'coverage',

  // Coverage Threshold Enforcement
  // Implements 100% coverage requirements across all metrics per Section 6.6.6.1
  coverageThreshold: {
    global: {
      // Line Coverage: 100% - Every line of code must be executed during tests
      lines: 100,
      
      // Function Coverage: 100% - All functions must be invoked during tests
      functions: 100,
      
      // Branch Coverage: 100% - All conditional branches must be tested
      // Critical for error handling paths and conditional logic validation
      branches: 100,
      
      // Statement Coverage: 100% - Every executable statement must be covered
      statements: 100
    }
  },

  // Test Setup and Teardown Configuration
  // Ensures clean test environment and proper resource management
  setupFilesAfterEnv: [],
  teardownFilesAfterEnv: [],

  // Test Execution Configuration
  // Optimizes test execution for reliability and performance
  testTimeout: 10000,           // 10-second timeout for individual tests
  maxWorkers: 1,               // Single worker to prevent port conflicts
  detectOpenHandles: true,     // Detects resource leaks and unclosed handles
  forceExit: false,           // Allows graceful shutdown for server cleanup
  clearMocks: true,           // Automatically clears mock state between tests
  restoreMocks: true,         // Restores original implementations after tests

  // Module Resolution Configuration
  // Supports standard Node.js module resolution patterns
  moduleFileExtensions: [
    'js',
    'json',
    'node'
  ],

  // Transform Configuration
  // No transformations needed for standard Node.js JavaScript files
  transform: {},
  transformIgnorePatterns: [
    '/node_modules/'
  ],

  // Mock Configuration
  // Preserves module mocking capabilities for error scenario testing
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,

  // Verbose Output Configuration
  // Provides detailed test execution information for debugging and analysis
  verbose: true,

  // Error Handling Configuration
  // Ensures comprehensive error reporting and debugging capabilities
  errorOnDeprecated: true,
  bail: 1,                    // Stops test execution on first failure for fast feedback
  
  // Watch Mode Configuration (for development)
  // Optimizes file watching for efficient development workflow
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/.git/'
  ],

  // Notification Configuration
  // Disables system notifications to prevent CI/CD environment issues
  notify: false,
  notifyMode: 'failure-change',

  // Performance Configuration
  // Optimizes Jest performance for single-file testing scenarios
  cache: true,
  cacheDirectory: '/tmp/jest_cache',

  // Reporter Configuration
  // Uses default reporter with enhanced error information
  reporters: [
    'default'
  ],

  // Global Test Configuration
  // Defines global variables and utilities available in all tests
  globals: {
    // Server configuration constants for consistent testing
    TEST_SERVER_HOST: '127.0.0.1',
    TEST_SERVER_PORT: 3000,
    TEST_TIMEOUT: 5000
  },

  // Test Result Processing
  // Configures test result collection and processing
  collectCoverage: false,      // Coverage collection controlled by CLI flags
  passWithNoTests: false,     // Requires at least one test to pass build

  // Module Mapping
  // No module path mapping required for simple server structure
  moduleNameMapping: {},

  // Setup Files
  // No global setup files required for current testing scope
  setupFiles: [],

  // Snapshot Configuration
  // Configures snapshot testing capabilities for response validation
  updateSnapshot: false,
  snapshotSerializers: [],

  // Project Configuration
  // Single project configuration for focused server testing
  projects: undefined,

  // Dependency Management
  // Handles external dependencies for testing environment
  testEnvironmentOptions: {},
  moduleDirectories: [
    'node_modules'
  ],

  // Advanced Configuration
  // Additional configuration options for enterprise-grade testing
  slowTestThreshold: 5,        // Identifies slow tests (>5 seconds)
  testLocationInResults: true, // Includes test file locations in results
  testNamePattern: undefined,  // No test name filtering by default
  testPathPattern: undefined,  // No test path filtering by default
  useStderr: false,           // Uses stdout for consistent output handling

  // Exit Code Configuration
  // Ensures proper exit codes for CI/CD pipeline integration
  testFailureExitCode: 1,     // Non-zero exit code on test failures
  
  // Coverage Threshold per File (optional enhancement)
  // Can be uncommented to enforce per-file coverage if needed
  /*
  coverageThreshold: {
    global: {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100
    },
    './server.js': {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100
    }
  }
  */
};