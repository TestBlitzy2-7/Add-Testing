/**
 * Server Lifecycle Management Helper Utilities
 * 
 * Comprehensive test helper module providing server lifecycle management for automated testing.
 * Enables unit and integration tests to programmatically manage server instances, handle error
 * scenarios, and maintain clean test environments without cross-test interference.
 * 
 * Features:
 * - Programmatic server instance creation and management
 * - Port conflict simulation for error scenario testing
 * - Graceful shutdown procedures with resource cleanup
 * - Test isolation management to prevent interference
 * - Port availability verification utilities
 * - Setup and teardown lifecycle hooks
 * 
 * @fileoverview Test utilities for comprehensive HTTP server lifecycle management
 * @version 1.0.0
 */

const http = require('http');
const { exec, spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

/**
 * Server Lifecycle Manager Class
 * 
 * Provides comprehensive management capabilities for HTTP server instances during testing.
 * Handles server creation, startup, shutdown, and resource management with proper isolation.
 */
class ServerLifecycleManager {
    constructor(options = {}) {
        this.defaultPort = options.port || 3000;
        this.defaultHostname = options.hostname || '127.0.0.1';
        this.serverInstances = new Map();
        this.childProcesses = new Set();
        this.portRegistry = new Set([this.defaultPort]);
        this.shutdownTimeout = options.shutdownTimeout || 5000;
        this.startupTimeout = options.startupTimeout || 3000;
        this.serverPath = options.serverPath || path.resolve(__dirname, '../../server.js');
        
        // Bind methods to preserve context
        this.cleanup = this.cleanup.bind(this);
        this.gracefulShutdown = this.gracefulShutdown.bind(this);
        
        // Register cleanup handlers for process termination
        process.on('exit', this.cleanup);
        process.on('SIGINT', this.gracefulShutdown);
        process.on('SIGTERM', this.gracefulShutdown);
        process.on('uncaughtException', this.gracefulShutdown);
        process.on('unhandledRejection', this.gracefulShutdown);
    }

    /**
     * Creates a programmatic server instance for testing
     * 
     * @param {Object} config - Server configuration options
     * @param {number} config.port - Port number for server binding (default: 3000)
     * @param {string} config.hostname - Hostname for server binding (default: '127.0.0.1')
     * @param {string} config.instanceId - Unique identifier for the server instance
     * @returns {Promise<Object>} Server instance with metadata
     */
    async createServerInstance(config = {}) {
        const instanceId = config.instanceId || `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const port = config.port || await this.findAvailablePort();
        const hostname = config.hostname || this.defaultHostname;

        // Verify port availability before creation
        const isPortAvailable = await this.isPortAvailable(port);
        if (!isPortAvailable) {
            throw new Error(`EADDRINUSE: Port ${port} is already in use`);
        }

        // Create server instance with the same logic as server.js
        const server = http.createServer((req, res) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Hello, World!\n');
        });

        const instance = {
            id: instanceId,
            server,
            port,
            hostname,
            isRunning: false,
            startTime: null,
            stopTime: null,
            connections: new Set(),
            metadata: {
                testContext: config.testContext || 'unknown',
                createdAt: new Date().toISOString(),
                pid: process.pid
            }
        };

        // Track active connections for graceful shutdown
        server.on('connection', (socket) => {
            instance.connections.add(socket);
            socket.on('close', () => {
                instance.connections.delete(socket);
            });
        });

        // Register the instance
        this.serverInstances.set(instanceId, instance);
        this.portRegistry.add(port);

        return instance;
    }

    /**
     * Starts a server instance and waits for successful binding
     * 
     * @param {Object} instance - Server instance object
     * @param {Object} options - Startup options
     * @param {number} options.timeout - Maximum time to wait for startup (default: 3000ms)
     * @param {boolean} options.waitForReady - Wait for server ready event (default: true)
     * @returns {Promise<Object>} Started server instance with updated metadata
     */
    async startServerInstance(instance, options = {}) {
        if (instance.isRunning) {
            throw new Error(`Server instance ${instance.id} is already running`);
        }

        const timeout = options.timeout || this.startupTimeout;
        const waitForReady = options.waitForReady !== false;

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Server startup timeout: Failed to start within ${timeout}ms`));
            }, timeout);

            const onListening = () => {
                instance.isRunning = true;
                instance.startTime = Date.now();
                clearTimeout(timeoutId);
                
                // Verify actual binding
                const address = instance.server.address();
                if (address && address.port === instance.port) {
                    resolve(instance);
                } else {
                    reject(new Error(`Server bound to unexpected port: ${address?.port} instead of ${instance.port}`));
                }
            };

            const onError = (error) => {
                instance.isRunning = false;
                clearTimeout(timeoutId);
                
                // Enhanced error information for port conflicts
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`EADDRINUSE: Port ${instance.port} is already in use. Server instance ${instance.id} failed to start.`));
                } else {
                    reject(new Error(`Server startup failed: ${error.message}`));
                }
            };

            instance.server.once('listening', onListening);
            instance.server.once('error', onError);

            // Start the server
            instance.server.listen(instance.port, instance.hostname);
        });
    }

    /**
     * Stops a server instance gracefully with proper resource cleanup
     * 
     * @param {Object} instance - Server instance to stop
     * @param {Object} options - Shutdown options
     * @param {number} options.timeout - Maximum time to wait for graceful shutdown
     * @param {boolean} options.force - Force shutdown after timeout (default: true)
     * @returns {Promise<Object>} Stopped server instance with updated metadata
     */
    async stopServerInstance(instance, options = {}) {
        if (!instance.isRunning) {
            return instance;
        }

        const timeout = options.timeout || this.shutdownTimeout;
        const force = options.force !== false;

        return new Promise((resolve, reject) => {
            let timeoutId;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                instance.isRunning = false;
                instance.stopTime = Date.now();
                this.portRegistry.delete(instance.port);
                resolve(instance);
            };

            // Set timeout for forced shutdown
            if (force) {
                timeoutId = setTimeout(() => {
                    // Force close all connections
                    for (const socket of instance.connections) {
                        socket.destroy();
                    }
                    instance.connections.clear();
                    
                    // Force server close
                    instance.server.close(() => cleanup());
                }, timeout);
            }

            // Graceful shutdown
            instance.server.close((error) => {
                if (error && !force) {
                    if (timeoutId) clearTimeout(timeoutId);
                    reject(new Error(`Graceful shutdown failed: ${error.message}`));
                } else {
                    cleanup();
                }
            });

            // Close existing connections gracefully
            for (const socket of instance.connections) {
                socket.end();
            }
        });
    }

    /**
     * Spawns a child process running server.js for integration testing
     * 
     * @param {Object} config - Process spawn configuration
     * @param {number} config.port - Port override via environment variable
     * @param {string} config.hostname - Hostname override via environment variable
     * @param {string} config.testId - Test identifier for process tracking
     * @returns {Promise<Object>} Child process information with control methods
     */
    async spawnServerProcess(config = {}) {
        const testId = config.testId || `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const port = config.port || await this.findAvailablePort();
        
        // Verify server.js exists
        if (!fs.existsSync(this.serverPath)) {
            throw new Error(`Server file not found: ${this.serverPath}`);
        }

        const env = {
            ...process.env,
            PORT: port.toString(),
            HOSTNAME: config.hostname || this.defaultHostname,
            NODE_ENV: 'test'
        };

        return new Promise((resolve, reject) => {
            const child = spawn('node', [this.serverPath], {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });

            const processInfo = {
                id: testId,
                pid: child.pid,
                port,
                hostname: config.hostname || this.defaultHostname,
                process: child,
                stdout: '',
                stderr: '',
                isRunning: true,
                startTime: Date.now(),
                stopTime: null
            };

            // Track the process
            this.childProcesses.add(processInfo);

            // Capture output
            child.stdout.on('data', (data) => {
                processInfo.stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                processInfo.stderr += data.toString();
            });

            // Handle process exit
            child.on('exit', (code, signal) => {
                processInfo.isRunning = false;
                processInfo.stopTime = Date.now();
                processInfo.exitCode = code;
                processInfo.exitSignal = signal;
                this.childProcesses.delete(processInfo);
                this.portRegistry.delete(port);
            });

            // Handle spawn errors
            child.on('error', (error) => {
                processInfo.isRunning = false;
                this.childProcesses.delete(processInfo);
                reject(new Error(`Failed to spawn server process: ${error.message}`));
            });

            // Wait for server to be ready (look for startup message)
            const readyTimeout = setTimeout(() => {
                if (processInfo.isRunning) {
                    // Kill the process if it didn't start properly
                    child.kill('SIGTERM');
                    reject(new Error(`Server process startup timeout: No ready signal received within 3 seconds`));
                }
            }, 3000);

            // Check for ready signal in stdout
            const checkReady = () => {
                if (processInfo.stdout.includes('running at')) {
                    clearTimeout(readyTimeout);
                    this.portRegistry.add(port);
                    resolve(processInfo);
                }
            };

            child.stdout.on('data', checkReady);

            // Add control methods to process info
            processInfo.terminate = async (signal = 'SIGTERM') => {
                if (processInfo.isRunning) {
                    return new Promise((resolveKill) => {
                        child.once('exit', () => resolveKill());
                        child.kill(signal);
                        
                        // Force kill after timeout
                        setTimeout(() => {
                            if (processInfo.isRunning) {
                                child.kill('SIGKILL');
                            }
                        }, 2000);
                    });
                }
            };
        });
    }

    /**
     * Simulates port conflict scenarios for error handling testing
     * 
     * @param {number} targetPort - Port to create conflict on
     * @param {Object} options - Conflict simulation options
     * @returns {Promise<Object>} Conflict simulation controller with cleanup methods
     */
    async simulatePortConflict(targetPort, options = {}) {
        const conflictId = `conflict_${targetPort}_${Date.now()}`;
        const holdDuration = options.holdDuration || 5000;
        const immediate = options.immediate !== false;

        // Create a basic server to occupy the port
        const conflictServer = http.createServer((req, res) => {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Port conflict simulation active\n');
        });

        const conflictInfo = {
            id: conflictId,
            port: targetPort,
            server: conflictServer,
            startTime: Date.now(),
            endTime: null,
            isActive: false,
            autoRelease: options.autoRelease !== false
        };

        return new Promise((resolve, reject) => {
            conflictServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Cannot simulate port conflict: Port ${targetPort} is already in use`));
                } else {
                    reject(new Error(`Port conflict simulation failed: ${error.message}`));
                }
            });

            conflictServer.on('listening', () => {
                conflictInfo.isActive = true;
                this.portRegistry.add(targetPort);

                // Auto-release after duration if configured
                if (conflictInfo.autoRelease && holdDuration > 0) {
                    setTimeout(async () => {
                        await conflictInfo.release();
                    }, holdDuration);
                }

                resolve(conflictInfo);
            });

            // Add control methods
            conflictInfo.release = async () => {
                if (conflictInfo.isActive) {
                    return new Promise((resolveRelease) => {
                        conflictServer.close(() => {
                            conflictInfo.isActive = false;
                            conflictInfo.endTime = Date.now();
                            this.portRegistry.delete(targetPort);
                            resolveRelease();
                        });
                    });
                }
            };

            conflictInfo.extend = (additionalTime) => {
                if (conflictInfo.isActive && conflictInfo.autoRelease) {
                    setTimeout(async () => {
                        await conflictInfo.release();
                    }, additionalTime);
                }
            };

            // Start the conflict server
            if (immediate) {
                conflictServer.listen(targetPort, '127.0.0.1');
            } else {
                // Delayed start for more complex test scenarios
                setTimeout(() => {
                    conflictServer.listen(targetPort, '127.0.0.1');
                }, options.delay || 100);
            }
        });
    }

    /**
     * Verifies if a port is available on the specified hostname
     * 
     * @param {number} port - Port number to check
     * @param {string} hostname - Hostname to check (default: '127.0.0.1')
     * @param {number} timeout - Connection timeout in milliseconds (default: 1000)
     * @returns {Promise<boolean>} True if port is available, false if occupied
     */
    async isPortAvailable(port, hostname = '127.0.0.1', timeout = 1000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let isResolved = false;

            const cleanup = () => {
                if (!isResolved) {
                    isResolved = true;
                    socket.destroy();
                }
            };

            const onTimeout = setTimeout(() => {
                cleanup();
                resolve(true); // Timeout suggests port is available
            }, timeout);

            socket.on('connect', () => {
                clearTimeout(onTimeout);
                cleanup();
                resolve(false); // Successfully connected = port is occupied
            });

            socket.on('error', (error) => {
                clearTimeout(onTimeout);
                cleanup();
                // Connection refused typically means port is available
                resolve(error.code === 'ECONNREFUSED');
            });

            socket.connect(port, hostname);
        });
    }

    /**
     * Finds an available port starting from a base port number
     * 
     * @param {number} startPort - Starting port number (default: 3001)
     * @param {number} maxAttempts - Maximum ports to try (default: 100)
     * @param {string} hostname - Hostname to check (default: '127.0.0.1')
     * @returns {Promise<number>} Available port number
     */
    async findAvailablePort(startPort = 3001, maxAttempts = 100, hostname = '127.0.0.1') {
        for (let port = startPort; port < startPort + maxAttempts; port++) {
            // Skip ports already in our registry
            if (this.portRegistry.has(port)) {
                continue;
            }

            const isAvailable = await this.isPortAvailable(port, hostname);
            if (isAvailable) {
                return port;
            }
        }

        throw new Error(`No available ports found in range ${startPort}-${startPort + maxAttempts - 1}`);
    }

    /**
     * Waits for a server to become available on the specified port and hostname
     * 
     * @param {number} port - Port number to monitor
     * @param {string} hostname - Hostname to monitor (default: '127.0.0.1')
     * @param {Object} options - Wait options
     * @param {number} options.timeout - Maximum wait time in milliseconds (default: 5000)
     * @param {number} options.interval - Check interval in milliseconds (default: 100)
     * @returns {Promise<boolean>} True when server becomes available
     */
    async waitForServerReady(port, hostname = '127.0.0.1', options = {}) {
        const timeout = options.timeout || 5000;
        const interval = options.interval || 100;
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const check = async () => {
                if (Date.now() - startTime > timeout) {
                    reject(new Error(`Server ready timeout: No response from ${hostname}:${port} within ${timeout}ms`));
                    return;
                }

                const isOccupied = !(await this.isPortAvailable(port, hostname, 500));
                if (isOccupied) {
                    resolve(true);
                } else {
                    setTimeout(check, interval);
                }
            };

            check();
        });
    }

    /**
     * Creates setup and teardown hooks for test frameworks
     * 
     * @param {Object} config - Hook configuration
     * @param {string} config.testSuite - Test suite identifier
     * @param {boolean} config.autoCleanup - Enable automatic cleanup (default: true)
     * @param {number} config.setupTimeout - Setup timeout in milliseconds (default: 5000)
     * @returns {Object} Setup and teardown functions for test integration
     */
    createTestHooks(config = {}) {
        const testSuite = config.testSuite || 'default';
        const autoCleanup = config.autoCleanup !== false;
        const setupTimeout = config.setupTimeout || 5000;
        
        const suiteInstances = new Map();
        const suiteProcesses = new Set();

        return {
            /**
             * Setup hook for test initialization
             * Creates isolated test environment with port allocation
             */
            setup: async () => {
                // Clean any existing instances for this suite
                await this.cleanupTestSuite(testSuite);
                
                // Pre-allocate ports to prevent conflicts
                const availablePorts = [];
                for (let i = 0; i < 5; i++) {
                    const port = await this.findAvailablePort(3001 + (i * 100));
                    availablePorts.push(port);
                    this.portRegistry.add(port);
                }

                suiteInstances.set(`${testSuite}_ports`, availablePorts);
                
                return {
                    availablePorts,
                    createServer: async (options = {}) => {
                        const instanceConfig = {
                            ...options,
                            testContext: testSuite,
                            port: options.port || availablePorts.shift()
                        };
                        const instance = await this.createServerInstance(instanceConfig);
                        suiteInstances.set(instance.id, instance);
                        return instance;
                    },
                    spawnProcess: async (options = {}) => {
                        const processConfig = {
                            ...options,
                            testId: `${testSuite}_${options.testId || 'process'}`,
                            port: options.port || availablePorts.shift()
                        };
                        const processInfo = await this.spawnServerProcess(processConfig);
                        suiteProcesses.add(processInfo);
                        return processInfo;
                    }
                };
            },

            /**
             * Teardown hook for test cleanup
             * Ensures all resources are properly released
             */
            teardown: async () => {
                const cleanupPromises = [];

                // Clean up server instances
                for (const [key, instance] of suiteInstances) {
                    if (key.endsWith('_ports')) continue;
                    
                    if (instance.isRunning) {
                        cleanupPromises.push(
                            this.stopServerInstance(instance, { timeout: 2000, force: true })
                                .catch(error => console.warn(`Warning: Failed to stop instance ${instance.id}:`, error.message))
                        );
                    }
                }

                // Clean up child processes
                for (const processInfo of suiteProcesses) {
                    if (processInfo.isRunning) {
                        cleanupPromises.push(
                            processInfo.terminate('SIGTERM')
                                .catch(error => console.warn(`Warning: Failed to terminate process ${processInfo.id}:`, error.message))
                        );
                    }
                }

                // Wait for all cleanup operations
                await Promise.allSettled(cleanupPromises);

                // Clear suite tracking
                suiteInstances.clear();
                suiteProcesses.clear();

                // Additional cleanup for ports
                const ports = suiteInstances.get(`${testSuite}_ports`) || [];
                for (const port of ports) {
                    this.portRegistry.delete(port);
                }
            },

            /**
             * Individual test cleanup for test isolation
             */
            afterEach: async () => {
                if (autoCleanup) {
                    // Quick cleanup of any hanging instances
                    const quickCleanup = [];
                    
                    for (const [key, instance] of suiteInstances) {
                        if (key.endsWith('_ports')) continue;
                        
                        if (instance.isRunning && instance.metadata.testContext === testSuite) {
                            quickCleanup.push(
                                this.stopServerInstance(instance, { timeout: 1000, force: true })
                                    .catch(() => {}) // Silent cleanup
                            );
                        }
                    }

                    await Promise.allSettled(quickCleanup);
                }
            }
        };
    }

    /**
     * Cleans up all resources for a specific test suite
     * 
     * @param {string} testSuite - Test suite identifier
     * @returns {Promise<void>} Cleanup completion promise
     */
    async cleanupTestSuite(testSuite) {
        const cleanupPromises = [];

        // Clean server instances
        for (const [instanceId, instance] of this.serverInstances) {
            if (instance.metadata.testContext === testSuite) {
                if (instance.isRunning) {
                    cleanupPromises.push(
                        this.stopServerInstance(instance, { timeout: 1000, force: true })
                            .finally(() => this.serverInstances.delete(instanceId))
                    );
                } else {
                    this.serverInstances.delete(instanceId);
                }
            }
        }

        // Clean child processes
        for (const processInfo of this.childProcesses) {
            if (processInfo.id.startsWith(testSuite)) {
                if (processInfo.isRunning) {
                    cleanupPromises.push(
                        processInfo.terminate('SIGKILL')
                            .catch(() => {}) // Force cleanup, ignore errors
                    );
                }
            }
        }

        await Promise.allSettled(cleanupPromises);
    }

    /**
     * Comprehensive cleanup of all managed resources
     * Called automatically on process termination
     * 
     * @returns {Promise<void>} Cleanup completion promise
     */
    async cleanup() {
        const cleanupPromises = [];

        // Stop all server instances
        for (const [instanceId, instance] of this.serverInstances) {
            if (instance.isRunning) {
                cleanupPromises.push(
                    this.stopServerInstance(instance, { timeout: 1000, force: true })
                        .catch(() => {}) // Ignore cleanup errors during shutdown
                );
            }
        }

        // Terminate all child processes
        for (const processInfo of this.childProcesses) {
            if (processInfo.isRunning) {
                cleanupPromises.push(
                    processInfo.terminate('SIGKILL')
                        .catch(() => {}) // Force cleanup, ignore errors
                );
            }
        }

        // Wait for cleanup with timeout
        const cleanupTimeout = new Promise(resolve => setTimeout(resolve, 2000));
        await Promise.race([
            Promise.allSettled(cleanupPromises),
            cleanupTimeout
        ]);

        // Clear all tracking data
        this.serverInstances.clear();
        this.childProcesses.clear();
        this.portRegistry.clear();
    }

    /**
     * Graceful shutdown handler for process termination signals
     * 
     * @param {string|number} exitCode - Process exit code or signal
     * @returns {Promise<void>} Shutdown completion promise
     */
    async gracefulShutdown(exitCode = 0) {
        console.log('\nInitiating graceful shutdown of server lifecycle manager...');
        
        try {
            await this.cleanup();
            console.log('Server lifecycle cleanup completed successfully.');
        } catch (error) {
            console.error('Error during lifecycle cleanup:', error.message);
        }

        // Only exit if we're handling a signal
        if (typeof exitCode === 'string' || exitCode !== 0) {
            process.exit(typeof exitCode === 'number' ? exitCode : 1);
        }
    }

    /**
     * Gets comprehensive status information about all managed resources
     * 
     * @returns {Object} Current status of all server instances and processes
     */
    getStatus() {
        const status = {
            timestamp: new Date().toISOString(),
            serverInstances: {
                total: this.serverInstances.size,
                running: 0,
                stopped: 0,
                details: []
            },
            childProcesses: {
                total: this.childProcesses.size,
                running: 0,
                stopped: 0,
                details: []
            },
            portRegistry: Array.from(this.portRegistry).sort(),
            memoryUsage: process.memoryUsage()
        };

        // Collect server instance details
        for (const [instanceId, instance] of this.serverInstances) {
            if (instance.isRunning) {
                status.serverInstances.running++;
            } else {
                status.serverInstances.stopped++;
            }

            status.serverInstances.details.push({
                id: instanceId,
                port: instance.port,
                hostname: instance.hostname,
                isRunning: instance.isRunning,
                uptime: instance.startTime ? Date.now() - instance.startTime : null,
                connections: instance.connections.size,
                testContext: instance.metadata.testContext
            });
        }

        // Collect child process details
        for (const processInfo of this.childProcesses) {
            if (processInfo.isRunning) {
                status.childProcesses.running++;
            } else {
                status.childProcesses.stopped++;
            }

            status.childProcesses.details.push({
                id: processInfo.id,
                pid: processInfo.pid,
                port: processInfo.port,
                hostname: processInfo.hostname,
                isRunning: processInfo.isRunning,
                uptime: processInfo.startTime ? Date.now() - processInfo.startTime : null,
                exitCode: processInfo.exitCode,
                exitSignal: processInfo.exitSignal
            });
        }

        return status;
    }
}

// Default instance for convenient access
const serverLifecycle = new ServerLifecycleManager();

// Export individual utility functions for direct use
const serverLifecycleUtils = {
    /**
     * Quick server instance creation and startup
     * 
     * @param {Object} config - Server configuration
     * @returns {Promise<Object>} Running server instance
     */
    async startServer(config = {}) {
        const instance = await serverLifecycle.createServerInstance(config);
        await serverLifecycle.startServerInstance(instance);
        return instance;
    },

    /**
     * Quick server instance shutdown
     * 
     * @param {Object} instance - Server instance to stop
     * @returns {Promise<Object>} Stopped server instance
     */
    async stopServer(instance) {
        return await serverLifecycle.stopServerInstance(instance);
    },

    /**
     * Create port conflict for testing error scenarios
     * 
     * @param {number} port - Port to create conflict on
     * @param {Object} options - Conflict options
     * @returns {Promise<Object>} Conflict controller
     */
    async createPortConflict(port, options = {}) {
        return await serverLifecycle.simulatePortConflict(port, options);
    },

    /**
     * Check if port is available
     * 
     * @param {number} port - Port to check
     * @param {string} hostname - Hostname to check
     * @returns {Promise<boolean>} Port availability status
     */
    async checkPort(port, hostname = '127.0.0.1') {
        return await serverLifecycle.isPortAvailable(port, hostname);
    },

    /**
     * Find next available port
     * 
     * @param {number} startPort - Starting port number
     * @returns {Promise<number>} Available port
     */
    async getAvailablePort(startPort = 3001) {
        return await serverLifecycle.findAvailablePort(startPort);
    },

    /**
     * Wait for server to become ready
     * 
     * @param {number} port - Port to monitor
     * @param {string} hostname - Hostname to monitor
     * @param {Object} options - Wait options
     * @returns {Promise<boolean>} Ready status
     */
    async waitForServer(port, hostname = '127.0.0.1', options = {}) {
        return await serverLifecycle.waitForServerReady(port, hostname, options);
    },

    /**
     * Spawn server process for integration testing
     * 
     * @param {Object} config - Process configuration
     * @returns {Promise<Object>} Process information with control methods
     */
    async spawnServer(config = {}) {
        return await serverLifecycle.spawnServerProcess(config);
    },

    /**
     * Get current status of all managed resources
     * 
     * @returns {Object} Comprehensive status information
     */
    getManagerStatus() {
        return serverLifecycle.getStatus();
    },

    /**
     * Manual cleanup of all resources
     * 
     * @returns {Promise<void>} Cleanup completion
     */
    async cleanup() {
        return await serverLifecycle.cleanup();
    }
};

module.exports = {
    ServerLifecycleManager,
    serverLifecycle,
    serverLifecycleUtils,
    
    // Individual exports for selective importing
    startServer: serverLifecycleUtils.startServer,
    stopServer: serverLifecycleUtils.stopServer,
    createPortConflict: serverLifecycleUtils.createPortConflict,
    checkPort: serverLifecycleUtils.checkPort,
    getAvailablePort: serverLifecycleUtils.getAvailablePort,
    waitForServer: serverLifecycleUtils.waitForServer,
    spawnServer: serverLifecycleUtils.spawnServer,
    cleanup: serverLifecycleUtils.cleanup,
    
    // Test framework integration helpers
    createTestHooks: (config) => serverLifecycle.createTestHooks(config),
    
    // Jest-specific helpers
    jestHooks: {
        beforeAll: async () => {
            // Global setup for Jest test suites
            return serverLifecycle.createTestHooks({ testSuite: 'jest' });
        },
        afterAll: async () => {
            // Global cleanup for Jest test suites
            await serverLifecycle.cleanup();
        },
        beforeEach: async () => {
            // Individual test setup
            return await serverLifecycle.findAvailablePort(3001);
        },
        afterEach: async () => {
            // Individual test cleanup
            // Note: Specific cleanup should be handled by test hooks
        }
    },

    // Mocha-specific helpers
    mochaHooks: {
        before: async function() {
            // Global setup for Mocha test suites
            this.serverLifecycle = serverLifecycle.createTestHooks({ testSuite: 'mocha' });
            return this.serverLifecycle;
        },
        after: async function() {
            // Global cleanup for Mocha test suites
            await serverLifecycle.cleanup();
        },
        beforeEach: async function() {
            // Individual test setup
            this.availablePort = await serverLifecycle.findAvailablePort(3001);
        },
        afterEach: async function() {
            // Individual test cleanup
            // Note: Specific cleanup should be handled by test hooks
        }
    }
};