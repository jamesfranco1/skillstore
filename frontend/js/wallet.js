/**
 * Wallet Module
 * Handles Phantom wallet connection
 */

const Wallet = {
  address: null,
  provider: null,

  /**
   * Get Phantom provider
   */
  getProvider() {
    if ('phantom' in window) {
      const provider = window.phantom?.solana;
      if (provider?.isPhantom) {
        return provider;
      }
    }
    return null;
  },

  /**
   * Check if Phantom is installed
   */
  isInstalled() {
    return this.getProvider() !== null;
  },

  /**
   * Connect wallet
   */
  async connect() {
    const provider = this.getProvider();
    
    if (!provider) {
      window.open('https://phantom.app/', '_blank');
      throw new Error('Phantom not installed');
    }

    try {
      const response = await provider.connect();
      this.address = response.publicKey.toString();
      this.provider = provider;
      
      // Listen for disconnect
      provider.on('disconnect', () => {
        this.address = null;
        this.onDisconnect?.();
      });

      // Listen for account change
      provider.on('accountChanged', (publicKey) => {
        if (publicKey) {
          this.address = publicKey.toString();
          this.onAccountChange?.(this.address);
        } else {
          this.address = null;
          this.onDisconnect?.();
        }
      });

      this.onConnect?.(this.address);
      return this.address;
    } catch (err) {
      console.error('Wallet connection failed:', err);
      throw err;
    }
  },

  /**
   * Disconnect wallet
   */
  async disconnect() {
    const provider = this.getProvider();
    if (provider) {
      await provider.disconnect();
    }
    this.address = null;
    this.provider = null;
    this.onDisconnect?.();
  },

  /**
   * Check for existing connection (auto-reconnect)
   */
  async checkConnection() {
    const provider = this.getProvider();
    if (!provider) return null;

    try {
      const response = await provider.connect({ onlyIfTrusted: true });
      this.address = response.publicKey.toString();
      this.provider = provider;
      this.onConnect?.(this.address);
      return this.address;
    } catch {
      // Not previously connected, that's fine
      return null;
    }
  },

  /**
   * Sign a message
   */
  async signMessage(message) {
    if (!this.provider) throw new Error('Wallet not connected');
    
    const encoded = new TextEncoder().encode(message);
    const signed = await this.provider.signMessage(encoded, 'utf8');
    return signed;
  },

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction(transaction) {
    if (!this.provider) throw new Error('Wallet not connected');
    
    const { signature } = await this.provider.signAndSendTransaction(transaction);
    return signature;
  },

  /**
   * Shorten address for display
   */
  shortenAddress(address = this.address) {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  },

  // Event callbacks (set by app.js)
  onConnect: null,
  onDisconnect: null,
  onAccountChange: null
};

window.Wallet = Wallet;

