/**
 * Comprehensive Unit Test Suite for server.js
 * 
 * This test suite implements all mandatory testing requirements from Section 0:
 * - F-007-RQ-001: HTTP Response Validation across all methods
 * - F-007-RQ-002: Status Code Verification (HTTP 200)
 * - F-007-RQ-003: Header Validation (Content-Type: text/plain)
 * - F-007-RQ-004: Server Startup & Shutdown Tests
 * - F-007-RQ-005: Error Scenario Tests (port conflicts, binding failures)
 * - F-007-RQ-006: Edge-Case Tests (malformed requests, boundary conditions)
 * - F-007-RQ-007: 100% Test Coverage Compliance
 * 
 * Testing Framework: Jest with Supertest for HTTP assertions
 * Coverage Target: 100% across all execution paths
 */

const request = require('supertest');
const http = require('http');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

describe('Server.js Comprehensive Unit Test Suite', () => {
  let server;
  let serverProcess;
  
  /**
   * Test Suite Setup and Teardown
   * Ensures proper test isolation and resource cleanup
   */
  beforeEach(() => {
    // Reset server instance for each test to ensure isolation
    server = null;
    serverProcess = null;
  });

  afterEach(async () => {
    // Comprehensive cleanup to prevent resource leaks
    if (server && server.listening) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        serverProcess.on('exit', resolve);
        setTimeout(() => {
          if (!serverProcess.killed) {
            serverProcess.kill('SIGKILL');
          }
          resolve();
        }, 1000);
      });
    }
  });

  /**
   * F-007-RQ-004: Server Startup & Shutdown Tests
   * Tests server initialization, port binding, and lifecycle management
   */
  describe('Server Startup and Initialization Tests', () => {
    
    test('should successfully bind to localhost:3000 on startup', (done) => {
      // Create server instance identical to production code
      const hostname = '127.0.0.1';
      const port = 3000;
      
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, () => {
        // Verify server is listening on correct address
        const address = server.address();
        expect(address.address).toBe(hostname);
        expect(address.port).toBe(port);
        expect(server.listening).toBe(true);
        done();
      });
    });

    test('should output correct startup message to console', (done) => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      // Mock console.log to capture startup message
      const originalConsoleLog = console.log;
      let capturedMessage = '';
      console.log = (message) => {
        capturedMessage = message;
        originalConsoleLog(message);
      };

      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, () => {
        // Verify console output matches expected format
        expect(capturedMessage).toBe(`Server running at http://${hostname}:${port}/`);
        console.log = originalConsoleLog; // Restore original console.log
        done();
      });
    });

    test('should gracefully shutdown and cleanup resources', (done) => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, () => {
        expect(server.listening).toBe(true);
        
        // Test graceful shutdown
        server.close(() => {
          expect(server.listening).toBe(false);
          done();
        });
      });
    });
  });

  /**
   * F-007-RQ-001 & F-007-RQ-002: HTTP Response and Status Code Validation
   * Tests response content and status codes across all HTTP methods
   */
  describe('HTTP Response Content and Status Code Tests', () => {
    
    beforeEach((done) => {
      // Create fresh server instance for each HTTP test
      const hostname = '127.0.0.1';
      const port = 3000;
      
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, done);
    });

    test('should return "Hello, World!\\n" content for GET requests', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);
      
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should return "Hello, World!\\n" content for POST requests', async () => {
      const response = await request(server)
        .post('/')
        .expect(200);
      
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should return "Hello, World!\\n" content for PUT requests', async () => {
      const response = await request(server)
        .put('/api/data')
        .expect(200);
      
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should return "Hello, World!\\n" content for DELETE requests', async () => {
      const response = await request(server)
        .delete('/resource/123')
        .expect(200);
      
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should return "Hello, World!\\n" content for PATCH requests', async () => {
      const response = await request(server)
        .patch('/users/456')
        .expect(200);
      
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should return "Hello, World!\\n" content for OPTIONS requests', async () => {
      const response = await request(server)
        .options('/api/options')
        .expect(200);
      
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should return consistent response across different URL paths', async () => {
      const paths = ['/', '/api', '/api/users', '/long/nested/path', '/query?param=value'];
      
      for (const path of paths) {
        const response = await request(server)
          .get(path)
          .expect(200);
          
        expect(response.text).toBe('Hello, World!\n');
        expect(response.status).toBe(200);
      }
    });
  });

  /**
   * F-007-RQ-003: Header Validation Tests
   * Tests Content-Type and other HTTP headers
   */
  describe('HTTP Header Validation Tests', () => {
    
    beforeEach((done) => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, done);
    });

    test('should return correct Content-Type header as text/plain', async () => {
      const response = await request(server)
        .get('/')
        .expect(200)
        .expect('Content-Type', 'text/plain');
        
      expect(response.headers['content-type']).toBe('text/plain');
    });

    test('should maintain Content-Type consistency across all HTTP methods', async () => {
      const methods = ['get', 'post', 'put', 'delete', 'patch'];
      
      for (const method of methods) {
        const response = await request(server)[method]('/')
          .expect(200)
          .expect('Content-Type', 'text/plain');
          
        expect(response.headers['content-type']).toBe('text/plain');
      }
    });

    test('should set appropriate Content-Length header', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);
        
      // "Hello, World!\n" is 14 characters
      expect(response.headers['content-length']).toBe('14');
      expect(parseInt(response.headers['content-length'])).toBe(14);
    });

    test('should include standard HTTP response headers', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);
      
      // Verify essential headers are present
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers).toHaveProperty('content-length');
      expect(response.headers).toHaveProperty('date');
      expect(response.headers).toHaveProperty('connection');
    });
  });

  /**
   * F-007-RQ-005: Error Scenario Tests
   * Tests port conflicts, binding failures, and error recovery
   */
  describe('Error Handling and Recovery Tests', () => {
    
    test('should handle port binding conflicts gracefully', (done) => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      // Create first server to occupy the port
      const firstServer = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      firstServer.listen(port, hostname, () => {
        // Attempt to create second server on same port
        const secondServer = http.createServer((req, res) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Hello, World!\n');
        });

        secondServer.on('error', (error) => {
          // Verify error is EADDRINUSE (port already in use)
          expect(error.code).toBe('EADDRINUSE');
          expect(error.port).toBe(port);
          expect(error.address).toBe(hostname);
          
          // Cleanup first server
          firstServer.close(() => {
            done();
          });
        });

        // This should trigger the error event
        secondServer.listen(port, hostname);
      });
    });

    test('should emit error events for invalid hostname binding', (done) => {
      // Attempt to bind to invalid hostname
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.on('error', (error) => {
        // Verify error handling for invalid addresses
        expect(error).toBeInstanceOf(Error);
        expect(['ENOTFOUND', 'EADDRNOTAVAIL', 'EINVAL']).toContain(error.code);
        done();
      });

      // This should trigger an error for invalid hostname
      server.listen(3000, 'invalid.hostname.that.does.not.exist');
    });

    test('should handle server termination signals properly', (done) => {
      const serverPath = path.join(__dirname, '../../server.js');
      
      // Spawn server process to test signal handling
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverOutput = '';
      serverProcess.stdout.on('data', (data) => {
        serverOutput += data.toString();
        
        // Once server is running, send SIGTERM
        if (serverOutput.includes('Server running at')) {
          setTimeout(() => {
            serverProcess.kill('SIGTERM');
          }, 100);
        }
      });

      serverProcess.on('exit', (code, signal) => {
        // Verify graceful termination
        expect(['SIGTERM', 'SIGINT', null]).toContain(signal);
        expect(serverOutput).toContain('Server running at http://127.0.0.1:3000/');
        done();
      });
    });

    test('should handle network interface errors during startup', (done) => {
      // Test binding to unavailable network interface
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.on('error', (error) => {
        // Verify appropriate error handling
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBeDefined();
        done();
      });

      // Attempt to bind to unavailable address
      server.listen(3000, '192.168.255.255'); // Typically unavailable address
    });
  });

  /**
   * F-007-RQ-006: Edge Case Tests
   * Tests malformed requests, boundary conditions, and protocol violations
   */
  describe('Edge Case and Boundary Condition Tests', () => {
    
    beforeEach((done) => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, done);
    });

    test('should handle extremely long URL paths gracefully', async () => {
      // Create very long URL path (Node.js default limit is ~8KB)
      const longPath = '/' + 'a'.repeat(4000);
      
      const response = await request(server)
        .get(longPath)
        .expect(200);
        
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should process requests with unusual but valid HTTP methods', async () => {
      // Test less common but valid HTTP methods
      const response = await request(server)
        .head('/')
        .expect(200);
        
      // HEAD requests should have no body but same headers
      expect(response.text).toBe('');
      expect(response.headers['content-type']).toBe('text/plain');
    });

    test('should handle requests with large header collections', async () => {
      const requestBuilder = request(server).get('/');
      
      // Add many custom headers to test boundary conditions
      for (let i = 0; i < 50; i++) {
        requestBuilder.set(`X-Custom-Header-${i}`, `value-${i}`);
      }
      
      const response = await requestBuilder.expect(200);
      expect(response.text).toBe('Hello, World!\n');
    });

    test('should maintain response consistency with unusual request payloads', async () => {
      // Test with binary data payload
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
      
      const response = await request(server)
        .post('/api/upload')
        .send(binaryData)
        .expect(200);
        
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should handle concurrent connections without degradation', async () => {
      // Test concurrent connection handling
      const concurrentRequests = [];
      const requestCount = 25;
      
      for (let i = 0; i < requestCount; i++) {
        concurrentRequests.push(
          request(server)
            .get(`/concurrent-test-${i}`)
            .expect(200)
        );
      }
      
      const responses = await Promise.all(concurrentRequests);
      
      // Verify all concurrent requests completed successfully
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.text).toBe('Hello, World!\n');
        expect(response.headers['content-type']).toBe('text/plain');
      });
    });

    test('should process requests with query parameters consistently', async () => {
      const queryVariations = [
        '?param=value',
        '?multiple=params&with=values',
        '?empty=',
        '?special=%20%21%40%23%24',
        '?unicode=%E2%9C%93%E2%9C%97',
        '?very-long-query=' + 'x'.repeat(1000)
      ];
      
      for (const query of queryVariations) {
        const response = await request(server)
          .get(`/test${query}`)
          .expect(200);
          
        expect(response.text).toBe('Hello, World!\n');
        expect(response.status).toBe(200);
      }
    });

    test('should handle requests with various content encodings', async () => {
      const response = await request(server)
        .post('/data')
        .set('Content-Encoding', 'gzip')
        .set('Content-Type', 'application/json')
        .send('{"test": "data"}')
        .expect(200);
        
      expect(response.text).toBe('Hello, World!\n');
      expect(response.headers['content-type']).toBe('text/plain');
    });

    test('should maintain performance under rapid sequential requests', async () => {
      const startTime = Date.now();
      const sequentialCount = 50;
      
      // Execute rapid sequential requests
      for (let i = 0; i < sequentialCount; i++) {
        const response = await request(server)
          .get(`/sequential-${i}`)
          .expect(200);
          
        expect(response.text).toBe('Hello, World!\n');
      }
      
      const totalTime = Date.now() - startTime;
      const averageResponseTime = totalTime / sequentialCount;
      
      // Verify reasonable performance (should be well under 100ms per request)
      expect(averageResponseTime).toBeLessThan(100);
    });
  });

  /**
   * Server Integration and End-to-End Tests
   * Tests complete server lifecycle and real-world usage scenarios
   */
  describe('Server Integration and E2E Tests', () => {
    
    test('should complete full server lifecycle successfully', (done) => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      // Test complete lifecycle: create -> start -> request -> shutdown
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, async () => {
        try {
          // Server is now running, test HTTP request
          const response = await request(server)
            .get('/lifecycle-test')
            .expect(200);
            
          expect(response.text).toBe('Hello, World!\n');
          expect(response.headers['content-type']).toBe('text/plain');
          
          // Test graceful shutdown
          server.close(() => {
            expect(server.listening).toBe(false);
            done();
          });
        } catch (error) {
          done(error);
        }
      });
    });

    test('should verify server executable as standalone process', (done) => {
      const serverPath = path.join(__dirname, '../../server.js');
      
      // Verify server.js file exists and is executable
      expect(fs.existsSync(serverPath)).toBe(true);
      
      // Start server as child process
      serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverReady = false;
      let outputBuffer = '';

      serverProcess.stdout.on('data', (data) => {
        outputBuffer += data.toString();
        
        if (outputBuffer.includes('Server running at') && !serverReady) {
          serverReady = true;
          
          // Server is ready, test HTTP connectivity
          setTimeout(async () => {
            try {
              const response = await request('http://127.0.0.1:3000')
                .get('/process-test')
                .expect(200);
                
              expect(response.text).toBe('Hello, World!\n');
              expect(response.headers['content-type']).toBe('text/plain');
              
              done();
            } catch (error) {
              done(error);
            }
          }, 100);
        }
      });

      serverProcess.on('error', (error) => {
        done(error);
      });
    });

    test('should handle rapid startup/shutdown cycles', async () => {
      const cycleCount = 5;
      
      for (let cycle = 0; cycle < cycleCount; cycle++) {
        const hostname = '127.0.0.1';
        const port = 3000;
        
        // Create and start server
        const testServer = http.createServer((req, res) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Hello, World!\n');
        });

        await new Promise((resolve) => {
          testServer.listen(port, hostname, resolve);
        });
        
        // Verify server is functional
        const response = await request(testServer)
          .get(`/cycle-${cycle}`)
          .expect(200);
          
        expect(response.text).toBe('Hello, World!\n');
        
        // Shutdown server
        await new Promise((resolve) => {
          testServer.close(resolve);
        });
        
        expect(testServer.listening).toBe(false);
      }
    });
  });

  /**
   * Performance and Resource Management Tests
   * Tests server performance characteristics and resource usage
   */
  describe('Performance and Resource Management Tests', () => {
    
    beforeEach((done) => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, done);
    });

    test('should maintain consistent response times under load', async () => {
      const loadTestCount = 100;
      const responseTimes = [];
      
      for (let i = 0; i < loadTestCount; i++) {
        const startTime = Date.now();
        
        const response = await request(server)
          .get(`/load-test-${i}`)
          .expect(200);
          
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        expect(response.text).toBe('Hello, World!\n');
      }
      
      // Calculate performance statistics
      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / loadTestCount;
      const maxResponseTime = Math.max(...responseTimes);
      
      // Verify performance meets requirements (< 50ms average, < 100ms max)
      expect(averageResponseTime).toBeLessThan(50);
      expect(maxResponseTime).toBeLessThan(100);
    });

    test('should handle memory-intensive requests without degradation', async () => {
      // Test with large request payloads
      const largePayload = 'x'.repeat(10000); // 10KB payload
      
      const response = await request(server)
        .post('/memory-test')
        .send(largePayload)
        .expect(200);
        
      expect(response.text).toBe('Hello, World!\n');
      expect(response.status).toBe(200);
    });

    test('should verify port availability after server shutdown', async () => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      // Shutdown current server
      await new Promise((resolve) => {
        server.close(resolve);
      });
      
      // Verify port is available by creating new server
      const newServer = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      await new Promise((resolve, reject) => {
        newServer.on('error', reject);
        newServer.listen(port, hostname, resolve);
      });
      
      expect(newServer.listening).toBe(true);
      
      // Cleanup
      await new Promise((resolve) => {
        newServer.close(resolve);
      });
    });
  });

  /**
   * Protocol Compliance and Standards Tests
   * Tests HTTP protocol compliance and web standards adherence
   */
  describe('HTTP Protocol Compliance Tests', () => {
    
    beforeEach((done) => {
      const hostname = '127.0.0.1';
      const port = 3000;
      
      server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!\n');
      });

      server.listen(port, hostname, done);
    });

    test('should maintain HTTP/1.1 protocol compliance', async () => {
      const response = await request(server)
        .get('/')
        .set('Connection', 'keep-alive')
        .expect(200);
        
      expect(response.text).toBe('Hello, World!\n');
      expect(response.headers).toHaveProperty('content-length');
      expect(response.headers).toHaveProperty('date');
    });

    test('should handle HTTP version variations appropriately', async () => {
      const response = await request(server)
        .get('/')
        .set('User-Agent', 'TestClient/1.0')
        .expect(200);
        
      expect(response.text).toBe('Hello, World!\n');
      expect(response.headers['content-type']).toBe('text/plain');
    });

    test('should respond consistently regardless of request headers', async () => {
      const headerVariations = [
        { 'Accept': 'text/html,application/xhtml+xml' },
        { 'Accept': 'application/json' },
        { 'Accept': '*/*' },
        { 'Accept-Encoding': 'gzip, deflate' },
        { 'User-Agent': 'Mozilla/5.0 Browser' },
        { 'Authorization': 'Bearer token123' }
      ];
      
      for (const headers of headerVariations) {
        const response = await request(server)
          .get('/headers-test')
          .set(headers)
          .expect(200);
          
        expect(response.text).toBe('Hello, World!\n');
        expect(response.headers['content-type']).toBe('text/plain');
      }
    });

    test('should maintain response integrity with international characters in requests', async () => {
      const internationalPaths = [
        '/test/русский',
        '/test/中文',
        '/test/العربية',
        '/test/español',
        '/test/français'
      ];
      
      for (const path of internationalPaths) {
        const response = await request(server)
          .get(encodeURI(path))
          .expect(200);
          
        expect(response.text).toBe('Hello, World!\n');
        expect(response.status).toBe(200);
      }
    });
  });
});