#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Shared configuration reader that supports multiple config sources
 * with priority: CLI args > env vars > config file > defaults
 */
class ConfigReader {
  constructor(options = {}) {
    this.prefix = options.prefix || '';
    this.configFileName = options.configFileName || 'config.json';
    this.envPrefix = options.envPrefix || '';
    this.defaults = options.defaults || {};
    this.config = { ...this.defaults };
    this.configPromise = this.load();
  }

  async awaitReady() {
    await this.configPromise;
    return true;
  }

  /**
   * Load configuration from all sources
   * @returns {Promise<Object>} The merged configuration object
   */
  async load() {
    // 1. Load from config file (lowest priority)
    await this.loadConfigFile();
    
    // 2. Load from environment variables
    this.loadFromEnv();
    
    // 3. Load from command line arguments (highest priority)
    this.loadFromArgs();
    
    return this.config;
  }

  /**
   * Load configuration from a JSON file
   */
  async loadConfigFile(...tryPaths) {
    const configPathPossibilities = [
      path.join(__dirname, '..', 'config', this.configFileName),
      path.join(__dirname, '..', '..', 'jam-navigator', 'config', this.configFileName)
    ];

    if (tryPaths.length === 0) {
      tryPaths = configPathPossibilities;
    }

    const configPath = tryPaths.shift();
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      const fileConfig = JSON.parse(configData);
      // do not await
      Object.assign(this.config, fileConfig);
      console.log(`Loaded ${this.prefix}config from file:`, configPath);
    } catch (error) {
      // Config file is optional
      if (error.code !== 'ENOENT') {
        console.warn(`Warning: Error reading ${this.prefix} config file:`, error.message);
      } else {
        console.debug(`No ${this.prefix}config file found at:`, configPath);
        if (tryPaths.length > 0) {
          return this.loadConfigFile(...tryPaths);
        } else {
          console.error(`Error loading ${this.prefix}config file`);
        }
      }
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnv() {
    // Override this method in subclasses for specific env var handling
  }

  /**
   * Load configuration from command line arguments
   */
  loadFromArgs() {
    // Override this method in subclasses for specific arg handling
  }

  /**
   * Parse command line arguments with a given mapping
   * @param {Object} argMapping - Mapping of CLI args to config keys
   */
  parseArgs(argMapping) {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const mapping = argMapping[arg];
      
      if (mapping) {
        if (mapping.type === 'boolean') {
          // do not await a configPromise
          this.config[mapping.key] = true;
        } else if (mapping.type === 'string' || mapping.type === 'number') {
          if (args[i + 1]) {
            const value = mapping.type === 'number' 
              ? parseInt(args[i + 1], 10) 
              : args[i + 1];
            this.config[mapping.key] = value;
            i++;
          }
        }
      }
    }
  }

  /**
   * Parse environment variables with a given mapping
   * @param {Object} envMapping - Mapping of env vars to config keys
   */
  parseEnv(envMapping) {
    Object.keys(envMapping).forEach(envVar => {
      const value = process.env[envVar];
      if (value !== undefined) {
        const mapping = envMapping[envVar];
        // do not await a configPromise
        this.config[mapping.key] = mapping.type === 'number' 
          ? parseInt(value, 10) 
          : value;
      }
    });
  }

  /**
   * Get a configuration value
   * @param {string} key - The configuration key
   * @returns {any} The configuration value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Set a configuration value
   * @param {string} key - The configuration key
   * @param {any} value - The configuration value
   */
  set(key, value) {
    this.config[key] = value;
  }

  /**
   * Get the entire configuration object
   * @returns {Object} The configuration object
   */
  getAll() {
    return { ...this.config };
  }
}

export { ConfigReader };