// utils/Logger.js
class Logger {
    constructor(namespace = 'App') {
      this.namespace = namespace;
      this.levels = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3,
      };
      
      // Nivel configurable según entorno
      this.currentLevel = process.env.NODE_ENV === 'production' ? 1 : 3;
    }
  
    setNamespace(namespace) {
      this.namespace = namespace;
      return this;
    }
  
    setLevel(level) {
      if (typeof level === 'number' && level >= 0 && level <= 3) {
        this.currentLevel = level;
      } else if (this.levels[level] !== undefined) {
        this.currentLevel = this.levels[level];
      }
      return this;
    }
  
    formatMessage(level, message, data) {
      const timestamp = new Date().toISOString();
      return `${timestamp} [${this.namespace}] [${level}]: ${message} ${data ? JSON.stringify(data, this.replacer) : ''}`;
    }
    
    // Evita errores de circularidad en objetos complejos
    replacer(key, value) {
      if (key === 'socket' || key === 'current') return '[Circular]';
      return value;
    }
  
    error(message, data) {
      if (this.currentLevel >= this.levels.ERROR) {
        console.error(this.formatMessage('ERROR', message, data));
      }
      return this;
    }
  
    warn(message, data) {
      if (this.currentLevel >= this.levels.WARN) {
        console.warn(this.formatMessage('WARN', message, data));
      }
      return this;
    }
  
    info(message, data) {
      if (this.currentLevel >= this.levels.INFO) {
        console.info(this.formatMessage('INFO', message, data));
      }
      return this;
    }
  
    debug(message, data) {
      if (this.currentLevel >= this.levels.DEBUG) {
        console.debug(this.formatMessage('DEBUG', message, data));
      }
      return this;
    }
    
    // Método para crear una instancia con un namespace específico
    static getLogger(namespace) {
      return new Logger(namespace);
    }
  }
  
  export default Logger;